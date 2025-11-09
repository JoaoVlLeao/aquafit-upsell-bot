// wpp.js
import wppconnect from "@wppconnect-team/wppconnect";
import qrcode from "qrcode-terminal";

let clientInstance = null;

/** -------------------------
 * Utilidades de número/JID
 * ------------------------- */

/**
 * Normaliza para dígitos e força BR (55) se ainda não tiver.
 * NÃO faz “magia” de DDD: recebe o que o server já decidiu.
 */
function toDigits(n) {
  return String(n || "").replace(/\D/g, "");
}

/**
 * Resolve o JID oficial do WhatsApp para um número.
 * Tenta pelas rotas suportadas pelo WPPConnect e só envia
 * quando tiver um id `_serialized` (ex.: 5535991370437@c.us).
 */
async function resolveJid(numberDigits) {
  if (!clientInstance) throw new Error("WPPConnect não iniciado.");

  const onlyDigits = toDigits(numberDigits);

  // Garantir country code BR (55) – seu servidor já decide o DDD correto.
  const e164 = onlyDigits.startsWith("55") ? onlyDigits : `55${onlyDigits}`;

  // 1) Perfil (camada web oficial)
  try {
    const prof = await clientInstance.getNumberProfile(e164);
    const jid =
      prof?.id?._serialized ||
      (prof?.id?.user && `${prof.id.user}@c.us`) ||
      null;
    if (jid) return jid;
  } catch (_) {}

  // 2) Status de número (retorna id quando existe)
  try {
    const st = await clientInstance.checkNumberStatus(e164);
    const jid =
      st?.id?._serialized ||
      (typeof st?.id === "string" ? st.id : null) ||
      (st?.number && `${st.number}@c.us`) ||
      null;
    if (jid) return jid;
  } catch (_) {}

  // 3) Último recurso: construir JID manualmente
  return `${e164}@c.us`;
}

/** -------------------------
 * Inicialização do WhatsApp
 * ------------------------- */

export async function iniciarWPP(headless = true) {
  if (process.env.SKIP_WPP === "true") {
    console.log("⏭️ SKIP_WPP=true: pulando conexão com WhatsApp.");
    return null;
  }

  clientInstance = await wppconnect.create({
    session: "recuperacao-upsell",
    headless,
    puppeteerOptions: { args: ["--no-sandbox"] },
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      try {
        console.log("📱 Escaneie o QR Code para conectar o WhatsApp:");
        qrcode.generate(urlCode, { small: true });
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
          urlCode
        )}`;
        console.log(`👉 ${qrUrl}`);
      } catch (err) {
        console.error("❌ Erro ao gerar link do QR:", err.message);
      }
    },
  });

  console.log("✅ WPPConnect conectado.");

  // Responder automaticamente APENAS a mensagens reais de chat
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

      const numero = message.from; // já vem como JID correto
      const nomeRaw =
        message.sender?.pushname ||
        message.sender?.name ||
        message.sender?.shortName ||
        "Cliente";

      const primeiroNome =
        nomeRaw?.toString()?.split(/\s+/)[0]?.replace(/[^A-Za-zÀ-ÿ]/g, "") ||
        "Cliente";

      console.log(`💬 ${primeiroNome} respondeu (${numero}): "${message.body}"`);

      await clientInstance.sendText(
        numero,
        `Oi ${primeiroNome}! 💚 Esse número é automático, mas nosso atendimento humano é feito pelo WhatsApp: *19 98773-6747* 💬`
      );

      console.log(`📩 Resposta automática enviada para ${numero}`);
    } catch (err) {
      console.error("❌ Erro ao responder automaticamente:", err.message);
    }
  });

  return clientInstance;
}

/** -------------------------
 * Envio com imagem/caption
 * ------------------------- */

export async function enviarMensagem(numeroBruto, mensagem) {
  const imageUrl =
    "https://udged.s3.sa-east-1.amazonaws.com/72117/ea89b4b8-12d7-4b80-8ded-0a43018915d4.png";

  if (process.env.DRY_RUN === "true") {
    console.log("🧪 DRY_RUN: simulação de envio ↓");
    console.log({ para: numeroBruto, jid: "(resolução pulada)", mensagem, imagem: imageUrl });
    return;
  }

  if (!clientInstance) throw new Error("Cliente WPPConnect não iniciado.");

  try {
    // ✅ passo crítico: resolver o JID correto antes de enviar
    const jid = await resolveJid(numeroBruto);

    // Envia usando o JID resolvido (não o número cru)
    await clientInstance.sendImage(jid, imageUrl, "upsell.png", mensagem);
    console.log(`📤 Mensagem + imagem enviadas para ${jid}`);

    try {
      await clientInstance.sendSeen(jid);
    } catch (_) {}
  } catch (err) {
    console.error("❌ Erro ao enviar mensagem:", err.message);
  }
}
