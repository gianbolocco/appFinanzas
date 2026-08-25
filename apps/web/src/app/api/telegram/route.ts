import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { anthropic } from "@ai-sdk/anthropic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramMessage(chatId: string, text: string, replyMarkup?: any) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const body: any = { chat_id: chatId, text };
  if (replyMarkup) body.reply_markup = replyMarkup;
  
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function editTelegramMessage(chatId: string, messageId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text }),
  });
}

const TransactionExtraction = z.object({
  amount: z.number().describe("El monto numérico del movimiento"),
  type: z.enum(["expense", "income"]).describe("Tipo de movimiento"),
  category_name: z.string().describe("El nombre exacto de la categoría elegida de la lista proporcionada, o 'Varios' si no aplica ninguna"),
  account_name: z.string().describe("El nombre exacto de la cuenta elegida de la lista proporcionada"),
  description: z.string().describe("Concepto breve del movimiento"),
  date: z.string().describe("Fecha en formato YYYY-MM-DD"),
});

export async function POST(req: Request) {
  let update: any = {};
  try {
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretToken && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    let parsedUpdate: any = null;
    try {
      parsedUpdate = await req.json();
    } catch(e) {}
    update = parsedUpdate || {};

    // ----------------------------------------------------------------------
    // Manejo de botones interactivos (Callback Queries)
    // ----------------------------------------------------------------------
    if (update.callback_query) {
      const cb = update.callback_query;
      const data = cb.data as string; // ej: "conf_UUID" o "canc_UUID"
      const chatId = cb.message.chat.id.toString();
      const messageId = cb.message.message_id;

      if (!data) return new Response("OK");

      const action = data.substring(0, 4);
      const pendingId = data.substring(5);

      if (action === "canc") {
        await supabaseAdmin.from("pending_bot_transactions").delete().eq("id", pendingId);
        await editTelegramMessage(chatId, messageId, "❌ Movimiento cancelado.");
        return new Response("OK");
      }

      if (action === "conf") {
        // Mover de pending a transactions
        const { data: pendingTx } = await supabaseAdmin
          .from("pending_bot_transactions")
          .select("*")
          .eq("id", pendingId)
          .single();

        if (!pendingTx) {
          await editTelegramMessage(chatId, messageId, "⚠️ El movimiento ya fue procesado o expiró.");
          return new Response("OK");
        }

        const { error: txError } = await supabaseAdmin.from("transactions").insert({
          user_id: pendingTx.user_id,
          type: pendingTx.type,
          amount: pendingTx.amount,
          currency: pendingTx.currency,
          date: pendingTx.date,
          description: pendingTx.description,
          category_id: pendingTx.category_id,
          account_id: pendingTx.account_id,
          source: "bot",
          converted_amount: pendingTx.amount, // asumiendo 1:1 localmente
          exchange_rate: 1,
        });

        if (txError) {
          console.error(txError);
          await editTelegramMessage(chatId, messageId, "❌ Error al guardar en la base de datos.");
        } else {
          await supabaseAdmin.from("pending_bot_transactions").delete().eq("id", pendingId);
          await editTelegramMessage(chatId, messageId, "✅ ¡Movimiento guardado con éxito!");
        }
        return new Response("OK");
      }

      return new Response("OK");
    }

    // ----------------------------------------------------------------------
    // Manejo de mensajes de texto normales
    // ----------------------------------------------------------------------
    const message = update.message;
    if (!message || !message.text) return new Response("OK");

    const chatId = message.chat.id.toString();
    const text = message.text.trim();

    // Comando de emparejamiento
    if (text.startsWith("/start ")) {
      const code = text.split(" ")[1].toUpperCase();
      const { data: pairCode } = await supabaseAdmin
        .from("pair_codes")
        .select("*")
        .eq("code", code)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .single();

      if (!pairCode) {
        await sendTelegramMessage(chatId, "❌ Código inválido o expirado. Generá uno nuevo en la app.");
        return new Response("OK");
      }

      await supabaseAdmin.from("bot_links").upsert({
        user_id: pairCode.user_id,
        telegram_chat_id: chatId,
        telegram_user_id: message.from.username || message.from.first_name,
      });

      await supabaseAdmin.from("pair_codes").update({ used_at: new Date().toISOString() }).eq("id", pairCode.id);
      await sendTelegramMessage(chatId, "✅ ¡Cuenta vinculada con éxito! Mandame tus gastos por acá. Ejemplo: 'Gasté 5000 en el super'.");
      return new Response("OK");
    }

    if (text === "/start" || text === "/help") {
      await sendTelegramMessage(chatId, "👋 Hola! Soy el bot de Guita. Para vincular tu cuenta, entrá a la app, andá a Ajustes > Integraciones y generá un código.");
      return new Response("OK");
    }

    // Verificar si está vinculado
    const { data: link } = await supabaseAdmin.from("bot_links").select("user_id").eq("telegram_chat_id", chatId).single();
    if (!link) {
      await sendTelegramMessage(chatId, "Tu cuenta no está vinculada. Generá un código en Ajustes.");
      return new Response("OK");
    }
    const userId = link.user_id;

    // Procesar con IA
    await sendTelegramMessage(chatId, "✍️ Analizando...");

    const [{ data: userProfile }, { data: categories }, { data: accounts }] = await Promise.all([
      supabaseAdmin.from("users").select("base_currency").eq("id", userId).single(),
      supabaseAdmin.from("categories").select("id, name").eq("user_id", userId),
      supabaseAdmin.from("accounts").select("id, name, currency, is_default").eq("user_id", userId),
    ]);

    if (!userProfile || !categories || !accounts || accounts.length === 0) {
      await sendTelegramMessage(chatId, "❌ Faltan configurar cuentas o categorías en tu app.");
      return new Response("OK");
    }

    const categoryNames = categories.map(c => c.name).join(", ");
    const accountNames = accounts.map(a => a.name).join(", ");

    let aiModel;
    if (process.env.ANTHROPIC_API_KEY) {
      aiModel = anthropic("claude-3-5-sonnet-latest");
    } else if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      aiModel = google("gemini-1.5-flash");
    } else {
      await sendTelegramMessage(chatId, "❌ Falta configurar una clave de IA en el servidor.");
      return new Response("OK");
    }

    const { object: extraction } = await generateObject({
      model: aiModel,
      schema: TransactionExtraction,
      system: `Sos un asistente inteligente de finanzas personales. Tu tarea es extraer la información del texto del usuario y mapearla a una transacción.
      La moneda base del usuario es ${userProfile.base_currency}. 
      Las categorías disponibles son: ${categoryNames}. 
      Las cuentas disponibles son: ${accountNames}.
      Elegí la categoría y la cuenta que más se acerquen al texto. Devolvé sus nombres exactos. Si no menciona una cuenta, asumí que usa la cuenta predeterminada de la lista.
      La fecha de hoy es ${new Date().toISOString().split("T")[0]}.`,
      prompt: text,
    });

    if (!extraction) {
      await sendTelegramMessage(chatId, "❌ No pude entender el movimiento. Intentá ser más específico.");
      return new Response("OK");
    }

    // Buscar IDs
    let categoryId = categories.find(c => c.name.toLowerCase() === extraction.category_name.toLowerCase())?.id;
    if (!categoryId) categoryId = categories[0].id;

    let accountObj = accounts.find(a => a.name.toLowerCase() === extraction.account_name.toLowerCase());
    if (!accountObj) accountObj = accounts.find(a => a.is_default) || accounts[0];

    // Guardar en tabla temporal
    const { data: pendingTx, error: pendingError } = await supabaseAdmin
      .from("pending_bot_transactions")
      .insert({
        user_id: userId,
        telegram_chat_id: chatId,
        type: extraction.type,
        amount: extraction.amount,
        currency: accountObj.currency,
        date: extraction.date,
        description: extraction.description,
        category_id: categoryId,
        account_id: accountObj.id,
      })
      .select("id")
      .single();

    if (pendingError || !pendingTx) {
      console.error(pendingError);
      await sendTelegramMessage(chatId, "❌ Hubo un error al preparar el gasto.");
      return new Response("OK");
    }

    const typeStr = extraction.type === "expense" ? "Gasto" : "Ingreso";
    const msgText = `¿Confirmar este ${typeStr.toLowerCase()}?\n\n💰 Monto: $${extraction.amount}\n📂 Categoría: ${extraction.category_name}\n🏦 Cuenta: ${accountObj.name}\n📝 Concepto: ${extraction.description}`;

    await sendTelegramMessage(chatId, msgText, {
      inline_keyboard: [
        [
          { text: "✅ Confirmar", callback_data: `conf_${pendingTx.id}` },
          { text: "❌ Cancelar", callback_data: `canc_${pendingTx.id}` }
        ]
      ]
    });

    return new Response("OK");
  } catch (err: any) {
    console.error("Webhook Error:", err);
    try {
      const chatId = update.message?.chat?.id || update.callback_query?.message?.chat?.id;
      if (chatId) {
        await sendTelegramMessage(chatId.toString(), "❌ Ocurrió un error inesperado al procesar. Reintentá en unos segundos.");
      }
    } catch(e) {}
    return new Response("OK", { status: 200 });
  }
}
