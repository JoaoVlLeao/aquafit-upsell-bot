import pkg from "@wppconnect-team/wppconnect";
import fs from "fs";
import path from "path";
const { create } = pkg;

const sessionName = "recuperacao-upsell";

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
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--disable-gpu",
    ],
    catchQR: async (base64Qr) => {
      const qrImagePath = path.join(dir, "qrcode.png");
      const imageBuffer = Buffer.from(base64Qr.replace("data:image/png;base64,", ""), "base64");
      fs.writeFileSync(qrImagePath, imageBuffer);

      // Gera link visual no console
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(base64Qr)}`;
      console.log(`✅ QR Code gerado! Escaneie aqui:\n${qrUrl}`);
      console.log("📲 Ou acesse /qr no navegador para escanear.");
    },
    statusFind: (statusSession) => {
      console.log("📱 Status da sessão:", statusSession);
    },
  })
    .then((client) => {
      console.log("✅ WhatsApp conectado e pronto (Upsell).");

      client.onMessage(async (msg) => {
        try {
          if (!msg.body || msg.body === "undefined") return;
          console.log(`💬 Cliente respondeu (${msg.from}): "${msg.body}"`);

          const numeroAdmin = "5519987736747@c.us";
          await client.sendText(numeroAdmin, `📩 Resposta de ${msg.from}: ${msg.body}`);

          await client.sendText(
            msg.from,
            "Oi 💚💗! Aqui é a equipe *AquaFit Brasil*. Essa é uma conta automática, mas já encaminhamos sua mensagem para nosso time de atendimento. 💬"
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

export async function enviarMensagem(numero, mensagem) {
  try {
    if (!numero || !mensagem) return console.warn("⚠️ Número ou mensagem ausente ao enviar.");

    const formatted = numero.startsWith("55") ? `${numero}@c.us` : `55${numero}@c.us`;
    console.log(`📤 Enviando mensagem para ${formatted}`);

    const client = await iniciarWPP(true);
    await client.sendText(formatted, mensagem);

    console.log(`📤 Mensagem enviada com sucesso para ${formatted}`);
  } catch (e) {
    console.error("❌ Erro ao enviar mensagem:", e);
  }
}
