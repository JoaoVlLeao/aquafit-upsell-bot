// wpp.js
import pkg from "@wppconnect-team/wppconnect";
const { create } = pkg;
import fs from "fs";
import path from "path";

let client = null;

/**
 * Inicializa o WhatsApp e registra todos os eventos importantes
 */
export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");

  const sessionPath = path.resolve("./tokens/recuperacao-upsell");

  client = await create({
    session: "recuperacao-upsell",
    catchQR: (base64Qr, asciiQR) => {
      console.log("📱 Escaneie o QR abaixo para conectar:\n");
      console.log(asciiQR);
      const qrPath = path.join("public", "qrcode.png");
      fs.writeFileSync(qrPath, Buffer.from(base64Qr.replace(/^data:image\/png;base64,/, ""), "base64"));
      console.log(`✅ QR Code atualizado em: ${qrPath}`);
    },
    puppeteerOptions: {
      headless,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    },
    folderNameToken: "./tokens",
    createPathFileToken: true,
    disableWelcome: true,
    logQR: false,
    autoClose: 0,
    updatesLog: false,
  });

  console.log("✅ WhatsApp conectado e pronto (Upsell).");

  // === Listener: mensagens recebidas ===
  client.onMessage(async (msg) => {
    try {
      const from = msg.from || "";
      const body = msg.body?.trim();

      // Ignora mensagens vazias ou "undefined"
      if (!body || body.toLowerCase().includes("undefined")) return;

      console.log(`💬 Cliente respondeu (${from}): "${body}"`);

      // === Envia notificação ao número principal ===
      const numeroSuporte = "5519987736747"; // << SEU NÚMERO DE SUPORTE AQUI

      const resposta = `📩 Resposta de *${from}*:\n"${body}"`;

      await client.sendText(numeroSuporte + "@c.us", resposta);
      console.log(`📤 Mensagem encaminhada para suporte (${numeroSuporte})`);

      // === Resposta automática ao cliente ===
      const mensagemAuto = `Oi 💚💗, aqui é a Carolina da *AquaFit Brasil*! Vi sua mensagem e nosso time vai te responder por aqui rapidinho 😊\n\nSe quiser um contato direto, você também pode chamar no nosso WhatsApp principal: https://wa.me/${numeroSuporte}`;
      await client.sendText(from, mensagemAuto);

      console.log(`📤 Mensagem automática enviada para ${from}`);
    } catch (err) {
      console.error("❌ Erro ao processar mensagem recebida:", err);
    }
  });

  return client;
}

/**
 * Envia uma mensagem normal
 */
export async function enviarMensagem(numero, mensagem) {
  if (!client) {
    throw new Error("❌ Cliente WhatsApp não inicializado.");
  }

  // Garantir formato correto (com @c.us)
  const destinatario = numero.startsWith("55") ? numero + "@c.us" : "55" + numero + "@c.us";

  try {
    await client.sendText(destinatario, mensagem);
    console.log(`📤 Mensagem enviada para ${destinatario}`);
  } catch (e) {
    console.error("❌ Erro ao enviar mensagem:", e);
  }
}
