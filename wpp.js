// wpp.js
import pkg from "@wppconnect-team/wppconnect";
import fs from "fs";
import path from "path";
const { create } = pkg;

const sessionName = "recuperacao-upsell";
const tokenPath = path.join(process.cwd(), "tokens", sessionName);
if (!fs.existsSync(tokenPath)) fs.mkdirSync(tokenPath, { recursive: true });

let clientInstance = null;
let clientReady = false;

/** 🧩 Normaliza número para o formato WhatsApp */
function formatarNumero(numero) {
  if (!numero) return null;
  let num = numero.toString().replace(/\D/g, "");

  if (num.startsWith("5555")) num = num.slice(2);
  if (!num.startsWith("55")) num = "55" + num;
  num = num.replace(/^550/, "55");

  if (num.length < 12 || num.length > 13) {
    console.warn("⚠️ Número inválido detectado:", num);
    return null;
  }

  return `${num}@c.us`;
}

/** 🚀 Inicia ou reaproveita sessão WhatsApp */
export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");

  if (clientInstance && clientReady) {
    console.log("♻️ Sessão WhatsApp já ativa. Reutilizando instância existente.");
    return clientInstance;
  }

  const lock = path.join(tokenPath, "SingletonLock");
  if (fs.existsSync(lock)) fs.rmSync(lock);

  const dir = path.join(process.cwd(), "public");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  clientInstance = await create({
    session: sessionName,
    headless,
    deviceName: "AquaFit Upsell Bot 💚💗",
    puppeteerOptions: { userDataDir: tokenPath },
    autoClose: false,
    disableWelcome: true,
    restartOnCrash: true,
    updatesLog: false,
    catchQRTimeout: 0,
    browserArgs: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-extensions",
      "--disable-gpu",
      "--disable-software-rasterizer",
      "--no-zygote",
      "--single-process",
      "--disable-infobars",
      "--window-size=1920,1080",
    ],

    catchQR: async (base64Qr, asciiQR, attempts, urlCode) => {
      const qrImagePath = path.join(dir, "qrcode.png");
      const imageBuffer = Buffer.from(base64Qr.replace("data:image/png;base64,", ""), "base64");
      fs.writeFileSync(qrImagePath, imageBuffer);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlCode)}`;
      console.log("\n✅ QR Code atualizado!");
      console.log("🔗 Escaneie o QR direto no navegador:");
      console.log(qrUrl);
      console.log("📲 Ou acesse /qr no navegador para visualizar a imagem.\n");
    },

    statusFind: (status) => console.log("📱 Status da sessão:", status),
  })
    .then((client) => {
      console.log("✅ WhatsApp conectado e pronto (Upsell).");
      clientReady = true;

      client.onMessage(async (msg) => {
        try {
          if (!msg.body || msg.body === "undefined") return;
          console.log(`💬 Cliente respondeu (${msg.from}): "${msg.body}"`);
          await client.sendText(
            msg.from,
            "Oi 💚💗! Aqui é a equipe *AquaFit Brasil*. Essa é uma conta automática, mas queremos te ajudar! 💬\n\n" +
              "Por favor, entre em contato com nosso *atendimento humano* através do número *19 98773-6747* 💬\n\n" +
              "Lá nossa equipe poderá te atender com mais rapidez 💚"
          );
          console.log(`📩 Mensagem automática enviada para ${msg.from}`);
        } catch (e) {
          console.error("❌ Erro ao responder cliente automaticamente:", e);
        }
      });

      return client;
    })
    .catch((err) => {
      console.error("❌ Erro ao iniciar WhatsApp:", err);
      clientReady = false;
      clientInstance = null;
    });

  return clientInstance;
}

/** 📤 Envia mensagem + imagem (se houver) */
export async function enviarMensagem(numero, mensagem, imagemUrl = null) {
  try {
    const formatted = formatarNumero(numero);
    if (!formatted) throw new Error(`Número inválido: ${numero}`);

    console.log(`📤 Enviando mensagem para ${formatted}`);

    const client = await iniciarWPP(true);
    if (!client) throw new Error("Cliente WhatsApp não disponível.");

    // Espera o cliente estar realmente pronto antes de enviar
    let tentativas = 0;
    while (!clientReady && tentativas < 10) {
      console.log("⏳ Aguardando cliente ficar pronto...");
      await new Promise((r) => setTimeout(r, 1500));
      tentativas++;
    }

    if (imagemUrl) {
      await client.sendImage(formatted, imagemUrl, "promo.jpg", mensagem);
      console.log(`🖼️ Imagem + legenda enviadas com sucesso para ${formatted}`);
    } else {
      await client.sendText(formatted, mensagem);
      console.log(`📩 Mensagem enviada com sucesso para ${formatted}`);
    }
  } catch (e) {
    console.error("❌ Erro ao enviar mensagem:", e);
  }
}
