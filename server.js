// server.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import axios from "axios";
import { fileURLToPath } from "url";
import { iniciarWPP, enviarMensagem } from "./wpp.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(bodyParser.json());

// === Pasta pública (QR Code) ===
const publicPath = path.join(__dirname, "public");
if (!fs.existsSync(publicPath)) fs.mkdirSync(publicPath, { recursive: true });
app.use(express.static(publicPath));

// === Página QR ===
app.get("/qr", (_req, res) => {
  const exists = fs.existsSync(path.join(publicPath, "qrcode.png"));
  res.send(`<!doctype html><html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#111;color:#fff;">
    <div style="text-align:center">
      <h2>QR Code do WhatsApp (Upsell)</h2>
      ${exists ? `<img src="/qrcode.png?ts=${Date.now()}" width="300"/>` : "<p>Carregando QR…</p>"}
    </div>
    <script>setTimeout(()=>location.reload(),4000)</script>
  </body></html>`);
});

let whatsappReadyAt = 0;

/** === Função: Normaliza telefone === */
function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  if (digits.length === 11) return "55" + digits;
  return digits || null;
}

/** === Webhook da Yampi === */
app.post("/webhook/yampi", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📦 Payload recebido do webhook Yampi (UPSELL):", JSON.stringify(payload, null, 2));

    const numero =
      payload?.resource?.customer?.data?.phone?.full_number ||
      payload?.customer?.data?.phone?.full_number ||
      payload?.resource?.customer?.data?.phone ||
      payload?.customer_phone;

    const nome = payload?.resource?.customer?.data?.first_name || "cliente";
    const numeroPedido = payload?.resource?.id || "000000";

    if (!numero) {
      console.warn("⚠️ Nenhum número de telefone encontrado.");
      return res.status(200).send("Ignorado: sem telefone válido.");
    }

    const numeroLimpo = normalizePhone(numero);
    console.log(`📞 Número recebido no webhook: ${numero}`);
    console.log(`🔧 Número sanitizado: ${numeroLimpo}`);

    const mensagem = `
Olá *${nome}*, seu pedido *${numeroPedido}* foi confirmado! 💚💗

É um prazer ter você como cliente 😍 Sabemos que você queria levar mais *peças* do nosso site.

Por isso temos um *presente especial* pra você 🎁

Acrescente *mais itens ao seu pedido* com um *super desconto*, sendo *enviados no mesmo frete*! 💚💗

Use o *cupom FLZ30* ao finalizar o seu pedido — *válido até o fim do dia*, em todo o site, *sem limite de itens*! 😍

👉 www.aquafitbrasil.com
`.trim();

    await enviarMensagem(numeroLimpo, mensagem);
    console.log(`✅ Mensagem + imagem enviadas com sucesso para ${numeroLimpo}`);
    res.status(200).json({ ok: true, enviado: true });
  } catch (e) {
    console.error("❌ Erro no webhook de upsell:", e);
    res.status(500).send("Erro interno no webhook de upsell.");
  }
});

/** === Inicialização === */
app.listen(process.env.PORT || 8080, async () => {
  console.log(`🚀 Upsell Server on :${process.env.PORT || 8080}`);
  const headless = String(process.env.HEADLESS || "true").toLowerCase() === "true";
  await iniciarWPP(headless);
  whatsappReadyAt = Date.now();
  console.log("🕘 whatsappReadyAt =", new Date(whatsappReadyAt).toISOString());
});
