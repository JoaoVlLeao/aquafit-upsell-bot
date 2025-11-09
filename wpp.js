// wpp.js
import wppconnect from "@wppconnect-team/wppconnect";
import fs from "fs";
import path from "path";
import axios from "axios"; // 👈 ESSA LINHA É ESSENCIAL

let clientInstance = null;

/** -------------------------
 * 🔹 Utilidades e verificação de sessão
 * ------------------------- */

/** Converte número para apenas dígitos */
function toDigits(n) {
  return String(n || "").replace(/\D/g, "");
}

/** Aguarda o WhatsApp (WAPI) estar pronto antes de qualquer operação */
async function waitForWapiReady(maxTries = 15) {
  for (let i = 0; i < maxTries; i++) {
    try {
      const ready = await clientInstance.isConnected();
      if (ready) {
        if (i > 0) console.log("✅ WAPI carregado e pronto.");
        return true;
      }
    } catch (_) {}
    console.log(`⌛ Aguardando WAPI estar pronto... (${i + 1}/${maxTries})`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("❌ WAPI não ficou pronto a tempo");
}

/** Resolve o JID oficial do WhatsApp (com suporte a contas Business) */
async function resolveJid(numberDigits) {
  if (!clientInstance) throw new Error("WPPConnect não iniciado.");

  await waitForWapiReady();

  const onlyDigits = toDigits(numberDigits);
  const e164 = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;
  let jid = null;

  // 1️⃣ checkNumberStatus (padrão)
  try {
    const st = await clientInstance.checkNumberStatus(e164);
    jid =
      st?.id?._serialized ||
      (typeof st?.id === "string" ? st.id : null) ||
      (st?.number && `${st.number}@c.us`) ||
      null;
    if (jid) {
      console.log(`🔎 JID resolvido via checkNumberStatus: ${jid}`);
      return jid;
    }
  } catch (err) {
    console.warn(`⚠️ checkNumberStatus falhou para ${e164}: ${err.message}`);
  }

  // 2️⃣ Tentativa de preparar contato (envio invisível)
  try {
    console.log(`⚙️ Tentando preparar contato ${e164}...`);
    const fake = `${e164}@c.us`;
    await clientInstance.sendText(fake, "‎"); // caractere invisível
    await new Promise((r) => setTimeout(r, 2000));

    const retry = await clientInstance.checkNumberStatus(e164);
    jid =
      retry?.id?._serialized ||
      (typeof retry?.id === "string" ? retry.id : null) ||
      (retry?.number && `${retry.number}@c.us`) ||
      null;

    if (jid) {
      console.log(`✅ Contato ${e164} preparado e resolvido: ${jid}`);
      return jid;
    }
  } catch (err) {
    console.warn(`⚠️ Falha ao preparar contato ${e164}: ${err.message}`);
  }

  // 3️⃣ Fallback final (não trava)
  console.log(`⚙️ Fallback manual usado para ${e164}`);
  return `${e164}@c.us`;
}

/** -------------------------
 * 🔹 Inicialização do WhatsApp
 * ------------------------- */
export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");

  const tokenPath = path.join(process.cwd(), "tokens", "recuperacao-upsell");
  if (!fs.existsSync(tokenPath)) fs.mkdirSync(tokenPath, { recursive: true });

  const fixedVersion = "2.2412.54"; // versão estável compatível com wapi.js

  clientInstance = await wppconnect.create({
    session: "recuperacao-upsell",
    headless,
    puppeteerOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    autoClose: false,
    disableWelcome: true,
    whatsappVersion: fixedVersion,

    /** === QR Code === */
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      try {
        const dir = path.join(process.cwd(), "public");
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const qrImagePath = path.join(dir, "qrcode.png");
        const imageBuffer = Buffer.from(
          base64Qr.replace("data:image/png;base64,", ""),
          "base64"
        );
        fs.writeFileSync(qrImagePath, imageBuffer);

        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          urlCode
        )}`;

        console.log("\n✅ QR Code atualizado!");
        console.log("🔗 Escaneie o QR direto no navegador:");
        console.log(qrUrl);
        console.log("📲 Ou acesse /qr no navegador para visualizar a imagem.\n");
      } catch (err) {
        console.error("❌ Erro ao gerar link do QR:", err.message);
      }
    },

    statusFind: (statusSession) => {
      console.log("📱 Status da sessão:", statusSession);
    },
  });

  console.log("✅ WhatsApp conectado e pronto (Upsell).");

  // 🔹 Responde automaticamente mensagens recebidas
  clientInstance.onMessage(async (message) => {
    try {
      if (
        message.fromMe ||
        message.isNotification ||
        message.type !== "chat" ||
        !message.body ||
        String(message.body).trim().toLowerCase() === "undefined"
      ) {
        return;
      }

      console.log(`💬 Cliente respondeu (${message.from}): "${message.body}"`);

      await clientInstance.sendText(
        message.from,
        "Oi 💚💗! Aqui é a equipe *AquaFit Brasil*. Essa é uma conta automática, mas queremos te ajudar! 💬\n\n" +
          "Por favor, entre em contato com nosso *atendimento humano* através do número *19 98773-6747* 💬\n\n" +
          "Lá nossa equipe poderá te atender com mais rapidez 💚"
      );

      console.log(`📩 Mensagem automática enviada para ${message.from}`);
    } catch (err) {
      console.error("❌ Erro ao responder automaticamente:", err.message);
    }
  });

  return clientInstance;
}

/** -------------------------
 * 🔹 Envio de mensagem com imagem e legenda
 * ------------------------- */
export async function enviarMensagem(numeroBruto, mensagem) {
  if (!numeroBruto || !mensagem) {
    console.warn("⚠️ Número ou mensagem ausente ao enviar.");
    return;
  }

  if (!clientInstance) {
    console.warn("⚠️ Cliente WhatsApp ainda não iniciado, iniciando agora...");
    await iniciarWPP(true);
  }

  try {
    const jid = await resolveJid(numeroBruto);
    console.log(`📤 Enviando mensagem para ${jid}`);

    const imagePath = path.join(process.cwd(), "public", "oferta.png");

// se não existir, baixa 1x do S3
if (!fs.existsSync(imagePath)) {
  const imageUrl =
    "https://udged.s3.sa-east-1.amazonaws.com/72117/ea89b4b8-12d7-4b80-8ded-0a43018915d4.png";
  const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
  fs.writeFileSync(imagePath, response.data);
  console.log("🖼️ Imagem baixada e salva localmente para uso offline.");
}

// envia imagem local (ultra rápido e estável)
await clientInstance.sendFile(jid, imagePath, "oferta.png", mensagem);
console.log(`✅ Mensagem + imagem enviadas com sucesso para ${jid}`);

    console.log(`✅ Mensagem + imagem enviadas com sucesso para ${jid}`);

    try {
      await clientInstance.sendSeen(jid);
    } catch (_) {}
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err.message);
  }
}
