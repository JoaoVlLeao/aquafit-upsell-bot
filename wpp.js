// wpp.js
import wppconnect from "@wppconnect-team/wppconnect";
import fs from "fs";
import path from "path";

let clientInstance = null;

/** -------------------------
 * 🔹 Utilidades de número / JID
 * ------------------------- */

/** Converte para dígitos puros */
function toDigits(n) {
  return String(n || "").replace(/\D/g, "");
}

/** Resolve o JID oficial do WhatsApp para um número */
async function resolveJid(numberDigits) {
  if (!clientInstance) throw new Error("WPPConnect não iniciado.");

  const onlyDigits = toDigits(numberDigits);
  const e164 = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;

  // 1️⃣ Tentativa principal – perfil do número
  try {
    const prof = await clientInstance.getNumberProfile(e164);
    const jid =
      prof?.id?._serialized ||
      (prof?.id?.user && `${prof.id.user}@c.us`) ||
      null;
    if (jid) return jid;
  } catch (_) {}

  // 2️⃣ Tentativa secundária – status do número
  try {
    const st = await clientInstance.checkNumberStatus(e164);
    const jid =
      st?.id?._serialized ||
      (typeof st?.id === "string" ? st.id : null) ||
      (st?.number && `${st.number}@c.us`) ||
      null;
    if (jid) return jid;
  } catch (_) {}

  // 3️⃣ Fallback – monta manualmente
  return `${e164}@c.us`;
}

/** -------------------------
 * 🔹 Inicialização do WhatsApp
 * ------------------------- */
export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");

  const tokenPath = path.join(process.cwd(), "tokens", "recuperacao-upsell");
  if (!fs.existsSync(tokenPath)) fs.mkdirSync(tokenPath, { recursive: true });

  clientInstance = await wppconnect.create({
    session: "recuperacao-upsell",
    headless,
    puppeteerOptions: { args: ["--no-sandbox", "--disable-setuid-sandbox"] },
    autoClose: false,
    disableWelcome: true,

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
        console.log(
          "📲 Ou acesse /qr no navegador para visualizar a imagem.\n"
        );
      } catch (err) {
        console.error("❌ Erro ao gerar link do QR:", err.message);
      }
    },

    statusFind: (statusSession) => {
      console.log("📱 Status da sessão:", statusSession);
    },
  });

  console.log("✅ WhatsApp conectado e pronto (Upsell).");

  // 🔹 Responde automaticamente a mensagens recebidas
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
    // resolve o JID real antes de enviar
    const jid = await resolveJid(numeroBruto);
    console.log(`📤 Enviando mensagem para ${jid}`);

    const imagemUrl =
      "https://udged.s3.sa-east-1.amazonaws.com/72117/ea89b4b8-12d7-4b80-8ded-0a43018915d4.png";

    // remove links de imagem redundantes no texto
    mensagem = mensagem.replace(/https?:\/\/\S+\.(png|jpg|jpeg|gif)/gi, "").trim();

    await clientInstance.sendImage(jid, imagemUrl, "oferta.png", mensagem);
    console.log(`✅ Mensagem + imagem enviadas com sucesso para ${jid}`);

    try {
      await clientInstance.sendSeen(jid);
    } catch (_) {}
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err.message);
  }
}
