// server.js
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import { CONFIG } from "./config.js";
import { iniciarWPP, enviarMensagem } from "./wpp.js";
import { analyzeWebhookAndBuildMessage } from "./ai.js";
import { enqueue } from "./queue.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(bodyParser.json());

// === Pasta pública (QR e arquivos) ===
const publicPath = path.join(__dirname, "public");
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
app.use(express.static(publicPath));

// === Página de QR code ===
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

/** === Função de varredura universal de telefone === */
function extrairTelefoneUniversal(payload) {
  try {
    // Converte todo o payload em string
    const jsonString = JSON.stringify(payload);

    // 🔹 Busca padrão mais completo primeiro (+55 XX XXXXX-XXXX)
    let match = jsonString.match(/\+?55[\s\-]?\(?\d{2}\)?[\s\-]?\d{4,5}[\s\-]?\d{4}/);
    if (match && match[0]) {
      const numero = match[0].replace(/\D/g, "");
      if (numero.length >= 11 && numero.length <= 13) return numero;
    }

    // 🔹 Se não encontrou, tenta telefones puros (ex: 31998444969)
    match = jsonString.match(/\d{10,11}/);
    if (match && match[0]) {
      const numero = match[0].replace(/\D/g, "");
      return numero.startsWith("55") ? numero : `55${numero}`;
    }

    // 🔹 Última camada: busca recursiva profunda
    let numeroEncontrado = null;
    function buscar(obj) {
      if (numeroEncontrado) return;
      if (typeof obj === "string") {
        const n = obj.replace(/\D/g, "");
        if (n.length >= 10 && n.length <= 13) {
          numeroEncontrado = n.startsWith("55") ? n : `55${n}`;
          return;
        }
      }
      if (typeof obj === "object" && obj !== null) {
        for (const key in obj) buscar(obj[key]);
      }
    }
    buscar(payload);
    if (numeroEncontrado) return numeroEncontrado;

    console.warn("⚠️ Nenhum número detectado após varredura total do payload.");
    return null;
  } catch (err) {
    console.error("❌ Erro ao extrair telefone:", err);
    return null;
  }
}

/** === Healthcheck === */
app.get("/health", (_req, res) => res.json({ ok: true, whatsappReadyAt }));

/** === Webhook principal (Yampi) === */
app.post("/webhook/yampi", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📦 Payload recebido do webhook Yampi (UPSELL):", JSON.stringify(payload, null, 2));

    // 🔹 Primeiro, tenta deixar o Gemini decidir (análise semântica)
    let ai = await analyzeWebhookAndBuildMessage(payload);

    // 🔹 Se o Gemini não achou telefone, tenta fallback manual
    if (!ai.phone_full) {
      console.log("⚠️ Gemini não conseguiu identificar o telefone. Tentando fallback...");
      const fallbackPhone = extrairTelefoneUniversal(payload);
      if (fallbackPhone) {
        ai.phone_full = fallbackPhone;
        console.log(`🔧 Fallback encontrou número: ${fallbackPhone}`);
      } else {
        console.warn("⚠️ Telefone ausente mesmo após fallback. Ignorando payload.");
        return res.status(200).send("Ignorado: telefone ausente.");
      }
    }

    // 🔹 Validação final da mensagem
    if (!ai.message || String(ai.message).toLowerCase().includes("undefined")) {
      console.warn("⚠️ Mensagem inválida vinda do Gemini. Ignorando envio.");
      return res.status(200).send("Ignorado: mensagem inválida.");
    }

    // 🔹 Retorna rapidamente para o Webhook da Yampi
    res.status(200).json({ ok: true, recebido: true, destino: ai.phone_full });

    // 🔹 Enfileira o envio real para o WhatsApp
    await enqueue(async () => {
      await enviarMensagem(ai.phone_full, ai.message, {
        imageUrl: ai.image_url || CONFIG.DEFAULT_IMAGE,
        localImageName: "oferta.png",
      });
    });

    console.log(`📤 Envio enfileirado com sucesso para ${ai.phone_full}`);
  } catch (err) {
    console.error("❌ Erro no webhook de upsell:", err);
    res.status(500).send("Erro interno no webhook de upsell.");
  }
});

/** === Inicialização do servidor === */
app.listen(CONFIG.PORT, async () => {
  console.log(`🚀 Upsell Server on :${CONFIG.PORT}`);
  await iniciarWPP(CONFIG.HEADLESS);
  whatsappReadyAt = Date.now();
  console.log("🕘 whatsappReadyAt =", new Date(whatsappReadyAt).toISOString());
});
