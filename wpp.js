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
    catchQR: (base64Qr) => {
      import("fs").then(fs => {
        import("path").then(path => {
          const filePath = path.resolve("public/qrcode.png");
          fs.writeFileSync(filePath, Buffer.from(base64Qr.split(",")[1], "base64"));
          console.log("📸 QR Code atualizado!");
        });
      });
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
        "--single-process"
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
