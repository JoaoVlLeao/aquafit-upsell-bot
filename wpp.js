// wpp.js
import pkg from "@wppconnect-team/wppconnect";
import fs from "fs";
import path from "path";
const { create } = pkg;

const sessionName = "recuperacao-upsell";

/**
 * Inicia sessão do WhatsApp
 */
export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");

  const dir = path.join(process.cwd(), "public");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  return create({
    session: sessionName,
    headless,
    browserArgs: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-software-rasterizer",
    ],
    catchQR: async (base64Qr) => {
      const qrImagePath = path.join(dir, "qrcode.png");
      const imageBuffer = Buffer.from(base64Qr.replace("data:image/png;base64,", ""), "base64");
      fs.writeFileSync(qrImagePath, imageBuffer);
      console.log("✅ QR Code atualizado (acesse /qr para escanear)");
    },
    statusFind: (statusSession) => {
      console.log("📱 Status da sessão:", statusSession);
    },
    onLoadingScreen: (percent, message) => {
      console.log("⌛", percent, message);
    },
  })
    .then((client) => {
      console.log("✅ WhatsApp conectado e pronto (Upsell).");

      // Listener para mensagens recebidas
      client.onMessage(async (msg) => {
        try {
          if (!msg.body || msg.body === "undefined") return;

          console.log(`💬 Cliente respondeu (${msg.from}): "${msg.body}"`);

          // Encaminhar para o número principal
          const numeroAdmin = "5519987736747@c.us";
          await client.sendText(numeroAdmin, `📩 Resposta de ${msg.from}: ${msg.body}`);

          // Resposta automática
          await client.sendText(
            msg.from,
            "Oi 💚💗! Aqui é a equipe AquaFit Brasil. Essa é uma conta automática, mas já encaminhamos sua mensagem para nosso time de atendimento. 💬"
          );

          console.log(`📩 Resposta de ${msg.from} encaminhada para ${numeroAdmin}`);
        } catch (e) {
          console.error("❌ Erro ao processar mensagem recebida:", e);
        }
      });

      return client;
    })
    .catch((err) => console.error("❌ Erro ao iniciar WhatsApp:", err));
}

/**
 * Envia uma mensagem para um número específico
 */
export async function enviarMensagem(numero, mensagem) {
  try {
    if (!numero || !mensagem) {
      console.warn("⚠️ Número ou mensagem ausente ao enviar.");
      return;
    }

    const formatted = numero.startsWith("55") ? `${numero}@c.us` : `55${numero}@c.us`;

    console.log(`📤 Enviando mensagem para ${formatted}`);
    const client = await iniciarWPP(true);
    await client.sendText(formatted, mensagem);
    console.log(`📤 Mensagem enviada com sucesso para ${formatted}`);
  } catch (e) {
    console.error("❌ Erro ao enviar mensagem:", e);
  }
}
