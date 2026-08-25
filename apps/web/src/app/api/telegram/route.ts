import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

const openai = new OpenAI();

// Admin client to bypass RLS since requests come from Telegram
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sendTelegramMessage(chatId: string, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

const TransactionExtraction = z.object({
  amount: z.number().describe("El monto numérico del movimiento"),
  type: z.enum(["expense", "income"]).describe("Tipo de movimiento"),
  category_name: z.string().describe("El nombre exacto de la categoría elegida de la lista proporcionada, o 'Varios' si no aplica ninguna"),
  description: z.string().describe("Concepto breve del movimiento"),
  date: z.string().describe("Fecha en formato YYYY-MM-DD"),
});

export async function POST(req: Request) {
  try {
    const secretToken = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretToken && secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      return new Response("Unauthorized", { status: 401 });
    }

    const update = await req.json();
    const message = update.message;

    if (!message || !message.text) {
      return new Response("OK");
    }

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

      // Vincular
      await supabaseAdmin.from("bot_links").upsert({
        user_id: pairCode.user_id,
        telegram_chat_id: chatId,
        telegram_user_id: message.from.username || message.from.first_name,
      });

      // Marcar código como usado
      await supabaseAdmin.from("pair_codes").update({ used_at: new Date().toISOString() }).eq("id", pairCode.id);

      await sendTelegramMessage(chatId, "✅ ¡Cuenta vinculada con éxito! Ya podés mandarme tus gastos por acá. Ejemplo: 'Gasté 5000 en el super'.");
      return new Response("OK");
    }

    // Comandos básicos
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

    // Notificar que estamos procesando
    await sendTelegramMessage(chatId, "✍️ Procesando gasto...");

    // Cargar datos del usuario para el contexto de la IA
    const [{ data: userProfile }, { data: categories }, { data: accounts }] = await Promise.all([
      supabaseAdmin.from("users").select("base_currency").eq("id", userId).single(),
      supabaseAdmin.from("categories").select("id, name, type").eq("user_id", userId),
      supabaseAdmin.from("accounts").select("id, name, currency").eq("user_id", userId),
    ]);

    if (!userProfile || !categories || !accounts || accounts.length === 0) {
      await sendTelegramMessage(chatId, "❌ Faltan configurar cuentas o categorías en tu app.");
      return new Response("OK");
    }

    const categoryNames = categories.map(c => c.name).join(", ");
    const defaultAccount = accounts[0]; // Usar la primera cuenta por defecto

    // Llamar a OpenAI
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `Sos un asistente inteligente de finanzas personales. Tu tarea es extraer la información del texto del usuario y mapearla a una transacción.
          La moneda base del usuario es ${userProfile.base_currency}. 
          Las categorías disponibles son: ${categoryNames}. 
          Elegí la categoría que más se acerque, y devolvé su nombre exacto.
          La fecha de hoy es ${new Date().toISOString().split("T")[0]}.`,
        },
        { role: "user", content: text },
      ],
      response_format: zodResponseFormat(TransactionExtraction, "transaction"),
    });

    const extraction = completion.choices[0].message.parsed;

    if (!extraction) {
      await sendTelegramMessage(chatId, "❌ No pude entender el gasto. Intentá ser más específico.");
      return new Response("OK");
    }

    // Buscar el ID de la categoría extraída
    let categoryId = categories.find(c => c.name.toLowerCase() === extraction.category_name.toLowerCase())?.id;
    if (!categoryId) {
      categoryId = categories[0].id; // Fallback
    }

    // Insertar la transacción
    const { error: txError } = await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: extraction.type,
      amount: extraction.amount,
      currency: defaultAccount.currency,
      date: extraction.date,
      description: extraction.description,
      category_id: categoryId,
      account_id: defaultAccount.id,
      source: "bot",
      converted_amount: extraction.amount, // Asume 1:1 con la moneda de la cuenta por ahora
      exchange_rate: 1,
    });

    if (txError) {
      console.error(txError);
      await sendTelegramMessage(chatId, "❌ Hubo un error al guardar el gasto en la base de datos.");
    } else {
      const typeStr = extraction.type === "expense" ? "Gasto" : "Ingreso";
      await sendTelegramMessage(chatId, `✅ ${typeStr} guardado!\nMonto: $${extraction.amount}\nCategoría: ${extraction.category_name}\nConcepto: ${extraction.description}`);
    }

    return new Response("OK");
  } catch (err) {
    console.error("Webhook Error:", err);
    return new Response("Error", { status: 500 });
  }
}
