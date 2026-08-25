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

async function downloadTelegramFile(fileId: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("No telegram token");
  const getFileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const getFileJson = await getFileRes.json();
  if (!getFileJson.ok) throw new Error("Could not get file info");
  
  const filePath = getFileJson.result.file_path;
  const fileRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  const arrayBuffer = await fileRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: (filePath.endsWith('.ogg') || filePath.endsWith('.oga') || filePath.startsWith('voice/')) ? 'audio/ogg' : 'image/jpeg'
  };
}

const TransactionExtraction = z.object({
  is_transaction: z.boolean().describe("True si el usuario quiere registrar un gasto, ingreso o transferencia. False si solo está saludando o consultando algo general."),
  reply_message: z.string().optional().describe("Si is_transaction es false, va tu respuesta amigable y de ayuda. También usalo si falta información vital."),
  amount: z.number().optional().describe("El monto numérico del movimiento"),
  type: z.enum(["expense", "income", "transfer"]).optional().describe("Tipo de movimiento"),
  category_name: z.string().optional().describe("El nombre de la categoría elegida de la lista proporcionada. Nulo si es transferencia."),
  account_name: z.string().optional().describe("El nombre exacto de la cuenta origen (o donde ingresa la plata)."),
  to_account_name: z.string().optional().describe("El nombre exacto de la cuenta destino (SOLO si es transferencia)."),
  description: z.string().optional().describe("Concepto breve del movimiento"),
  date: z.string().optional().describe("Fecha en formato YYYY-MM-DD"),
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
      const data = cb.data as string;
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
          note: pendingTx.description,
          category_id: pendingTx.category_id,
          account_id: pendingTx.account_id,
          to_account_id: pendingTx.to_account_id,
          source: "bot",
          amount_base: pendingTx.amount, // asumiendo 1:1
          dest_amount: pendingTx.type === "transfer" ? pendingTx.amount : null,
          exchange_rate: 1,
        });

        if (txError) {
          console.error(txError);
          await editTelegramMessage(chatId, messageId, "❌ Error al guardar en la base de datos.");
        } else {
          // Actualizar saldos de cuenta
          if (pendingTx.type === "transfer") {
            const { data: accFrom } = await supabaseAdmin.from("accounts").select("balance").eq("id", pendingTx.account_id).single();
            const { data: accTo } = await supabaseAdmin.from("accounts").select("balance").eq("id", pendingTx.to_account_id).single();
            
            if (accFrom) {
              await supabaseAdmin.from("accounts").update({ balance: accFrom.balance - pendingTx.amount }).eq("id", pendingTx.account_id);
            }
            if (accTo) {
              await supabaseAdmin.from("accounts").update({ balance: accTo.balance + pendingTx.amount }).eq("id", pendingTx.to_account_id);
            }
          } else {
            const sign = pendingTx.type === "income" ? 1 : -1;
            const { data: acc } = await supabaseAdmin.from("accounts").select("balance").eq("id", pendingTx.account_id).single();
            if (acc) {
              await supabaseAdmin.from("accounts").update({ balance: acc.balance + (sign * pendingTx.amount) }).eq("id", pendingTx.account_id);
            }
          }

          await supabaseAdmin.from("pending_bot_transactions").delete().eq("id", pendingId);
          await editTelegramMessage(chatId, messageId, "✅ ¡Movimiento guardado con éxito!");
        }
        return new Response("OK");
      }

      return new Response("OK");
    }

    // ----------------------------------------------------------------------
    // Manejo de mensajes de texto, audios e imágenes
    // ----------------------------------------------------------------------
    const message = update.message;
    if (!message) return new Response("OK");
    const chatId = message.chat.id.toString();

    let text = message.text ? message.text.trim() : "";
    let fileBuffer: Buffer | null = null;
    let fileMimeType: string | null = null;

    if (message.voice) {
      const file = await downloadTelegramFile(message.voice.file_id);
      fileBuffer = file.buffer;
      fileMimeType = file.mimeType;
      await sendTelegramMessage(chatId, "🎧 Escuchando audio...");
    } else if (message.photo && message.photo.length > 0) {
      const largestPhoto = message.photo[message.photo.length - 1];
      const file = await downloadTelegramFile(largestPhoto.file_id);
      fileBuffer = file.buffer;
      fileMimeType = file.mimeType;
      await sendTelegramMessage(chatId, "📸 Analizando imagen...");
    }

    if (!text && !fileBuffer) return new Response("OK");

    // Comando de emparejamiento
    if (text.startsWith("/start ") && text.split(" ").length > 1) {
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
      await sendTelegramMessage(chatId, "✅ ¡Cuenta vinculada con éxito! Mandame tus gastos, tickets o audios por acá.");
      return new Response("OK");
    }

    if (text === "/start" || text === "/help") {
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://appfinanzas.vercel.app";
      await sendTelegramMessage(chatId, `🤖 **Bot de Guita**\n\nPodés mandarme:\n- ✍️ Mensajes de texto ("Gaste 5 mil en verdulería")\n- 🎤 Notas de voz\n- 📸 Fotos de tickets\n- 🔄 Transferencias ("Pase 10 lucas de Efectivo a BBVA")\n\n🔗 [Abrir la App](${appUrl})`);
      return new Response("OK");
    }

    // Verificar si está vinculado
    const { data: link } = await supabaseAdmin.from("bot_links").select("user_id").eq("telegram_chat_id", chatId).single();
    if (!link) {
      const appUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://appfinanzas.vercel.app";
      await sendTelegramMessage(chatId, `❌ Tu cuenta de Telegram no está vinculada.\n\nPara vincularla, entrá a Ajustes > Integraciones en la app y generá un código.\n\n🔗 [Abrir la App](${appUrl})`);
      return new Response("OK");
    }
    const userId = link.user_id;

    if (!fileBuffer && text) {
      await sendTelegramMessage(chatId, "✍️ Analizando...");
    }

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
      aiModel = google("gemini-3.6-flash");
    } else {
      await sendTelegramMessage(chatId, "❌ Falta configurar una clave de IA en el servidor.");
      return new Response("OK");
    }

    const fileParts: any[] = [];
    if (fileBuffer && fileMimeType) {
      fileParts.push({ type: "file", data: fileBuffer, mimeType: fileMimeType });
    }

    const systemPrompt = `Sos un asistente inteligente de finanzas personales, amable y con buena onda.
      Tu tarea es extraer la información del texto o archivo del usuario y mapearla a una transacción o transferencia.
      Si el usuario solo está saludando o haciendo una pregunta general, pone is_transaction en false y responde amigablemente en reply_message.
      La moneda base del usuario es ${userProfile.base_currency}. 
      Las categorías disponibles son: ${categoryNames}. 
      Las cuentas disponibles son: ${accountNames}.
      Elegí la categoría y la cuenta que más se acerquen al texto. Devolvé sus nombres exactos. Si no menciona una cuenta, asumí que usa la cuenta predeterminada de la lista.
      La fecha de hoy es ${new Date().toISOString().split("T")[0]}.`;

    const userMessages: any[] = [
      { role: "user", content: [
        { type: "text", text: text || "Analizá el archivo adjunto para extraer el gasto o ingreso." },
        ...fileParts
      ]}
    ];

    const { object: extraction } = await generateObject({
      model: aiModel,
      schema: TransactionExtraction,
      system: systemPrompt,
      messages: userMessages,
    });

    if (!extraction) {
      await sendTelegramMessage(chatId, "❌ Hubo un error de procesamiento. Intentá nuevamente.");
      return new Response("OK");
    }

    if (!extraction.is_transaction) {
      await sendTelegramMessage(chatId, extraction.reply_message || "¡Hola! ¿En qué te puedo ayudar hoy?");
      return new Response("OK");
    }

    if (!extraction.amount || !extraction.type) {
      await sendTelegramMessage(chatId, "⚠️ No pude detectar el monto o el tipo de movimiento. ¿Me lo detallarías un poco más?");
      return new Response("OK");
    }

    // Buscar IDs
    let categoryId = null;
    if (extraction.type !== "transfer") {
      categoryId = categories.find(c => c.name.toLowerCase() === (extraction.category_name || "").toLowerCase())?.id;
      if (!categoryId) categoryId = categories[0].id;
    }

    let accountObj = accounts.find(a => a.name.toLowerCase() === (extraction.account_name || "").toLowerCase());
    if (!accountObj) accountObj = accounts.find(a => a.is_default) || accounts[0];

    let toAccountObj = null;
    if (extraction.type === "transfer" && extraction.to_account_name) {
      toAccountObj = accounts.find(a => a.name.toLowerCase() === extraction.to_account_name?.toLowerCase());
    }

    // Guardar en tabla temporal
    const { data: pendingTx, error: pendingError } = await supabaseAdmin
      .from("pending_bot_transactions")
      .insert({
        user_id: userId,
        telegram_chat_id: chatId,
        type: extraction.type,
        amount: extraction.amount,
        currency: accountObj.currency,
        date: extraction.date || new Date().toISOString().split("T")[0],
        description: extraction.description || "",
        category_id: categoryId,
        account_id: accountObj.id,
        to_account_id: toAccountObj ? toAccountObj.id : null,
      })
      .select("id")
      .single();

    if (pendingError || !pendingTx) {
      console.error(pendingError);
      await sendTelegramMessage(chatId, "❌ Hubo un error al preparar el movimiento.");
      return new Response("OK");
    }

    let typeStr = "Gasto";
    let msgText = "";
    
    if (extraction.type === "transfer") {
      typeStr = "Transferencia";
      msgText = `¿Confirmar esta ${typeStr}?\n\n💰 Monto: $${extraction.amount}\n📤 Origen: ${accountObj.name}\n📥 Destino: ${toAccountObj ? toAccountObj.name : "Desconocido"}\n📝 Concepto: ${extraction.description}`;
    } else {
      typeStr = extraction.type === "income" ? "Ingreso" : "Gasto";
      msgText = `¿Confirmar este ${typeStr.toLowerCase()}?\n\n💰 Monto: $${extraction.amount}\n📂 Categoría: ${extraction.category_name}\n🏦 Cuenta: ${accountObj.name}\n📝 Concepto: ${extraction.description}`;
    }

    await sendTelegramMessage(chatId, msgText, {
      inline_keyboard: [
        [
          { text: `✅ Confirmar ${typeStr}`, callback_data: `conf_${pendingTx.id}` },
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
        await sendTelegramMessage(chatId.toString(), "❌ Error: " + (err.message || String(err)));
      }
    } catch(e) {}
    return new Response("OK", { status: 200 });
  }
}
