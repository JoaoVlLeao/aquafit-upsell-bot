// server.js
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { CONFIG } from "./config.js";
import { iniciarWPP, enviarMensagem } from "./wpp.js";
import { extractPhoneWithGemini } from "./ai.js";
import { enqueue } from "./queue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

// === Pasta pública (QR/arquivos) ===
const publicPath = path.join(__dirname, "public");
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
app.use(express.static(publicPath));

// === Página QR ===
app.get("/qr", (_req, res) => {
  const qrTxt = path.join(publicPath, "qrcode.txt");
  const qrMsg = fs.existsSync(qrTxt) ? fs.readFileSync(qrTxt, "utf8") : null;
  res.send(`<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#111;color:#fff;">
    <div style="text-align:center">
      <h2>QR Code do WhatsApp (Upsell)</h2>
      ${qrMsg ? `<p><a href="${qrMsg}" target="_blank" style="color:#6cf">Abrir QR direto</a></p>` : "<p>Aguardando QR…</p>"}
    </div>
    <script>setTimeout(()=>location.reload(),4000)</script>
  </body></html>`);
});

let whatsappReadyAt = 0;

/** === Healthcheck === */
app.get("/health", (_req, res) => res.json({ ok: true, whatsappReadyAt }));

/** === Webhook genérico (qualquer origem) === */
app.post("/webhook/yampi", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📦 Payload recebido (UPSELL):", JSON.stringify(payload, null, 2));

    // 1) Gemini identifica telefone (única função de IA)
    const phoneE164 = await extractPhoneWithGemini(payload);
    if (!phoneE164) {
      console.warn("⚠️ Telefone não identificado pelo Gemini. Ignorando.");
      return res.status(200).send("Ignorado: telefone ausente.");
    }

    // 2) Mensagem fixa de Upsell (servidor cuida disso)
    const mensagem = `
Seu pedido foi confirmado! 💚💗

Aproveite o MESMO frete para incluir mais *peças* com desconto.
Use o cupom *FLZ30* — válido só hoje!

Garanta já: www.aquafitbrasil.com
    `.trim();

    // 3) Responde ao webhook rápido
    res.status(200).json({ ok: true, destino: phoneE164 });

    // 4) Enfileira o envio (evita travamentos/concorrência)
    await enqueue(async () => {
      await enviarMensagem(phoneE164, mensagem, {
        imageUrl: CONFIG.IMAGE_URL,
        localImageName: CONFIG.LOCAL_IMAGE_NAME,
      });
    });

    console.log(`📤 Envio enfileirado para ${phoneE164}`);
  } catch (err) {
    console.error("❌ Erro no webhook de upsell:", err);
    res.status(500).send("Erro interno no webhook de upsell.");
  }
});

/** === Inicialização === */
app.listen(CONFIG.PORT, async () => {
  console.log(`🚀 Upsell Server on :${CONFIG.PORT}`);
  await iniciarWPP(CONFIG.HEADLESS);
  whatsappReadyAt = Date.now();
  console.log("🕘 whatsappReadyAt =", new Date(whatsappReadyAt).toISOString());
});
