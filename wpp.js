// wpp.js
import pkg from "@wppconnect-team/wppconnect";
const { create, Client } = pkg;

export let client = null;

/**
 * Inicializa a sessão do WhatsApp Web
 */
export async function iniciarWPP(headless = true) {
  console.log("🚀 Iniciando sessão WhatsApp (Upsell)...");

  client = await create({
    session: "recuperacao-upsell",
    headless,
    useChrome: true,
    autoClose: false,
    restartOnCrash: true,
    catchQR: (base64Qr, asciiQR, attempts, urlCode) => {
      // Gera o link do QR diretamente no console (acessível de qualquer lugar)
      const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(urlCode)}`;
      console.log("📱 Escaneie este QR Code para conectar ao WhatsApp:");
      console.log(qrLink);
      console.log("\nOu copie e cole no navegador acima 👆 para abrir o QR.");
    },
    puppeteerOptions: {
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--single-process",
      ],
    },
  });

  console.log("✅ Sessão WhatsApp (Upsell) iniciada com sucesso!");
  return client;
}

/**
 * Envia mensagem para um número
 */
export async function enviarMensagem(numero, mensagem, imagemUrl = null) {
  if (!client) throw new Error("❌ Cliente WhatsApp não inicializado!");

  const numeroFormatado = numero.replace(/\D/g, "");
  const id = numeroFormatado.includes("@c.us")
    ? numeroFormatado
    : `${numeroFormatado}@c.us`;

  if (imagemUrl) {
    await client.sendImage(id, imagemUrl, "promo.jpg", mensagem);
    console.log(`📤 Mensagem + imagem enviadas para ${id}`);
  } else {
    await client.sendText(id, mensagem);
    console.log(`📤 Mensagem enviada para ${id}`);
  }
}
