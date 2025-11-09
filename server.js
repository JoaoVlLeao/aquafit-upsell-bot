// server-upsell.js
import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";
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

/** === Função: Varre e normaliza telefone === */
function extrairTelefone(payload) {
  try {
    const possiveisCampos = [
      payload?.customer?.phone?.full_number,
      payload?.customer?.phone?.number,
      payload?.customer?.phone,
      payload?.customer_phone,
      payload?.spreadsheet?.data?.customer_phone,
      payload?.tracking_data?.phone,
      payload?.whatsapp_link?.match(/phone=(\d+)/)?.[1],
      payload?.resource?.customer?.data?.phone?.full_number,
      payload?.resource?.customer?.data?.phone,
      payload?.resource?.customer?.phone,
      payload?.resource?.tracking_data?.phone,
    ];

    let numero = possiveisCampos.find((n) => typeof n === "string" && n.match(/\d{8,}/));
    if (!numero) return null;

    numero = numero.replace(/\D/g, "");
    const areaCode =
      payload?.customer?.phone?.area_code ||
      payload?.resource?.customer?.data?.phone?.area_code ||
      payload?.resource?.customer?.phone?.area_code ||
      "";

    if (numero.startsWith("55") && numero.length > 11) numero = numero.slice(2);
    if (numero.length < 11 && areaCode) numero = areaCode.replace(/\D/g, "") + numero;
    if (numero.startsWith("0")) numero = numero.slice(1);
    if (numero.length === 13 && numero.startsWith("55")) numero = numero.slice(2);

    return /^\d{10,11}$/.test(numero) ? numero : null;
  } catch (e) {
    console.error("Erro ao extrair telefone:", e);
    return null;
  }
}

/** === Função: Gera mensagem de upsell === */
function gerarMensagemUpsell(payload) {
  const nome =
    payload?.customer?.first_name ||
    payload?.resource?.customer?.data?.first_name ||
    payload?.customer?.name?.split(" ")?.[0] ||
    "cliente";
  const numeroPedido =
    payload?.order_id ||
    payload?.resource?.id ||
    payload?.resource?.order_id ||
    "seu pedido";

  return `
Olá *${nome}*, seu pedido de número *${numeroPedido}* foi confirmado, e é um prazer ter você como cliente! 😄  

Sabemos que você queria levar mais *peças* do nosso site... 💚💗  

Por isso, temos um *presente especial* para você! 🎁  

Acrescente *mais itens ao seu pedido* com um *super desconto*, sendo *enviados no mesmo frete*.  

Use o *cupom FLZ30* ao finalizar o seu pedido — o desconto é válido em todo o site, *sem limite de itens* e *válido para o dia de hoje*.  

Aproveite as promoções AquaFit Brasil e *leve mais por menos*:  
www.aquafitbrasil.com
  `.trim();
}

/** === Healthcheck === */
app.get("/health", (_req, res) => res.json({ ok: true, whatsappReadyAt }));

/** === Webhook Yampi (gatilho: pedido pago/confirmado) === */
app.post("/webhook/yampi", async (req, res) => {
  try {
    const payload = req.body;
    console.log("📦 Payload recebido do webhook Yampi (UPSELL):", JSON.stringify(payload, null, 2));

    // === Pega telefone da cliente ===
    const phone =
      payload?.customer?.data?.phone?.full_number ||
      payload?.resource?.customer?.data?.phone?.full_number ||
      payload?.spreadsheet?.data?.customer_phone;

    if (!phone) {
      console.warn("⚠️ Nenhum telefone encontrado no payload de upsell.");
      return res.status(200).send("Ignorado: sem telefone válido.");
    }

    // Sanitiza número
    const numero = phone.replace(/\D/g, "").replace(/^55/, "");
    const nome = payload?.customer?.data?.first_name || "cliente";
    const numeroPedido = payload?.resource?.id || "000000";
    const imagem = "https://udged.s3.sa-east-1.amazonaws.com/72117/ea89b4b8-12d7-4b80-8ded-0a43018915d4.png";

    // === Mensagem personalizada ===
    const mensagem = `
Olá *${nome}*, seu pedido de número *${numeroPedido}* foi confirmado! 💚💗

É um prazer ter você como cliente 😍 Nós sabemos que você queria levar mais peças do nosso site!

Por isso temos um *presente especial* para você 🎁

Acrescente *mais itens ao seu pedido* com um *super desconto*, sendo *enviados no mesmo frete* 💚💗

Use o *cupom FLZ30* ao finalizar o seu pedido — *válido até o fim do dia*, em todo o site, *sem limite de itens*! 😍

👉 www.aquafitbrasil.com
`;

    await enviarMensagem(numero, mensagem.trim());

    console.log(`📤 Mensagem de upsell enviada com sucesso para ${numero}`);
    res.status(200).json({ ok: true, enviado: true });
  } catch (err) {
    console.error("❌ Erro no webhook de upsell:", err);
    res.status(500).send("Erro interno no webhook de upsell.");
  }
});


/** === Inicialização === */
app.listen(process.env.PORT || 9090, async () => {
  console.log(`🚀 Upsell Server on :${process.env.PORT || 9090}`);
  const headless = String(process.env.HEADLESS || "true").toLowerCase() === "true";
  await iniciarWPP(headless);
  whatsappReadyAt = Date.now();
  console.log("🕘 whatsappReadyAt =", new Date(whatsappReadyAt).toISOString());
});
