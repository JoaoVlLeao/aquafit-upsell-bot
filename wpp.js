// wpp.js
import fs from "fs";
import path from "path";
import { create, Client } from "@wppconnect-team/wppconnect";

let client = null;
const qrPath = path.join(process.cwd(), "public/qrcode.png");

export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");
  client = await create({
    session: "recuperacao-upsell",
    headless,
    catchQR: (base64Qr) => {
      const base64Data = base64Qr.replace(/^data:image\/png;base64,/, "");
      fs.writeFileSync(qrPath, base64Data, "base64");
      console.log("📲 QR Code atualizado em /public/qrcode.png");
    },
    statusFind: (statusSession, session) => {
      console.log(`📡 Sessão ${session} status: ${statusSession}`);
    },
    onLoadingScreen: (percent, message) => {
      console.log("⌛", percent, message);
    },
  });

  client.onMessage(async (message) => {
    console.log("💬 Mensagem recebida:", message.body);
  });

  console.log("✅ WhatsApp conectado (Upsell bot).");
  return client;
}

/** Envia mensagem de texto simples */
export async function enviarMensagem(numero, mensagem) {
  try {
    if (!client) throw new Error("Cliente WhatsApp não inicializado.");
    const jid = `${numero}@c.us`;
    await client.sendText(jid, mensagem);
    console.log(`📤 Mensagem enviada com sucesso para ${numero}`);
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err);
  }
}
