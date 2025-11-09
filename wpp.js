// wpp.js
import wppconnect from "@wppconnect-team/wppconnect";
import qrcode from "qrcode-terminal";
import fs from "fs";
import path from "path";
import { ensureDir, ensureLocalImage, toDigits, delay } from "./utils.js";
import { CONFIG } from "./config.js";

let clientInstance = null;

async function resolveJid(numberDigits) {
  if (!clientInstance) throw new Error("WPPConnect não iniciado.");
  const onlyDigits = toDigits(numberDigits);
  const e164 = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;

  try {
    const prof = await clientInstance.getNumberProfile(e164);
    const jid = prof?.id?._serialized || (prof?.id?.user && `${prof.id.user}@c.us`) || null;
    if (jid) return jid;
  } catch (_) {}

  try {
    const st = await clientInstance.checkNumberStatus(e164);
    const jid =
      st?.id?._serialized ||
      (typeof st?.id === "string" ? st.id : null) ||
      (st?.number && `${st.number}@c.us`) ||
      null;
    if (jid) return jid;
  } catch (_) {}

  return `${e164}@c.us`;
}

export async function iniciarWPP(headless = CONFIG.HEADLESS) {
  if (process.env.SKIP_WPP === "true") {
    console.log("⏭️ SKIP_WPP=true: pulando conexão com WhatsApp.");
    return null;
  }

  clientInstance = await wppconnect.create({
    session: CONFIG.SESSION_NAME,
    headless,
    puppeteerOptions: {
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-gpu",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
      ],
    },
    autoClose: false,
    disableWelcome: true,
    catchQR: (_base64, _ascii, _attempts, urlCode) => {
      try {
        console.log("📱 Escaneie o QR Code para conectar o WhatsApp:");
        qrcode.generate(urlCode, { small: true });
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlCode)}`;
        console.log(`👉 ${qrUrl}`);
        const dir = path.join(process.cwd(), "public");
        ensureDir(dir);
        fs.writeFileSync(path.join(dir, "qrcode.txt"), qrUrl);
      } catch (err) {
        console.error("❌ Erro ao mostrar QR:", err.message);
      }
    },
    statusFind: (s) => console.log("📱 Status da sessão:", s),
  });

  console.log("✅ WPPConnect conectado.");

  clientInstance.onMessage(async (message) => {
    try {
      if (
        message.fromMe ||
        message.from === "status@broadcast" ||
        message.isNotification ||
        message.type !== "chat" ||
        !message.body ||
        String(message.body).trim().toLowerCase() === "undefined"
      ) {
        return;
      }
      const numero = message.from;
      console.log(`💬 Cliente respondeu (${numero}): "${message.body}"`);
      await clientInstance.sendText(
        numero,
        "Oi 💚💗! Esse número é automático. Nosso atendimento humano: *19 98773-6747* 💬"
      );
    } catch (err) {
      console.error("❌ Erro ao responder automaticamente:", err.message);
    }
  });

  return clientInstance;
}

export async function enviarMensagem(numeroE164, mensagem, opts = {}) {
  if (!numeroE164 || !mensagem) {
    console.warn("⚠️ Número ou mensagem ausente ao enviar.");
    return;
  }
  if (!clientInstance) throw new Error("Cliente WPPConnect não iniciado.");

  const imageUrl = opts.imageUrl || CONFIG.IMAGE_URL;
  const localImageName = opts.localImageName || CONFIG.LOCAL_IMAGE_NAME;

  try {
    const jid = await resolveJid(numeroE164);
    console.log(`📤 Enviando mensagem para ${jid}`);

    const publicDir = path.join(process.cwd(), "public");
    const imagePath = await ensureLocalImage(imageUrl, publicDir, localImageName);

    const cleanMsg = String(mensagem).replace(/https?:\/\/\S+\.(png|jpg|jpeg|gif)/gi, "").trim();

    const trySend = async () => {
      await clientInstance.sendFile(jid, imagePath, localImageName, cleanMsg);
    };

    try {
      await trySend();
    } catch (err) {
      const isTimeout =
        String(err?.message || err).includes("Runtime.callFunctionOn timed out") ||
        String(err?.message || err).toLowerCase().includes("timeout");
      if (isTimeout) {
        console.warn("⏳ Timeout no envio. Tentando novamente em 2s…");
        await delay(2000);
        await trySend();
      } else {
        throw err;
      }
    }

    console.log(`✅ Mensagem + imagem enviadas com sucesso para ${jid}`);
    try {
      await clientInstance.sendSeen(jid);
    } catch {}
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err.message);
  }
}
