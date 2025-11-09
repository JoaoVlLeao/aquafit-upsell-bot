// ai.js
import axios from "axios";
import { CONFIG } from "./config.js";
import { sanitizeWhatsText, normalizePhoneE164BR, safeJSONParse } from "./utils.js";

/**
 * Pede ao Gemini para:
 * - extrair telefone, nome, id do pedido do payload (qualquer formato)
 * - decidir mensagem (curta, humana, com CTA)
 * - decidir se envia imagem e qual URL (opcional)
 * - retornar JSON ESTRITO
 */
export async function analyzeWebhookAndBuildMessage(payload) {
  if (!CONFIG.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ausente no .env");

  const sys = `
Você é o cérebro de um bot de Upsell no WhatsApp da marca AquaFit Brasil 💚💗.
TAREFAS:
1) Ler o JSON do webhook (pode vir em formatos diferentes).
2) Extrair:
   - phone_full: string (telefone completo, em qualquer formato), obrigatório.
   - first_name: string (primeiro nome da cliente). Se não achar, use "cliente".
   - order_id: string (id/numero do pedido). Se não achar, "000000".
3) Montar uma mensagem CURTA (<= 500 chars), humana, com CTA e dicas:
   - Agradeça e confirme o pedido (use order_id).
   - Fale que pode adicionar mais peças com desconto e mesmo frete.
   - Cupom: FLZ30 (não diga %), válido só hoje.
   - Inclua o link www.aquafitbrasil.com com CTA.
   - Use no máx 3 emojis, sem parecer IA.
4) Indicar:
   - send_image: boolean (true para enviar imagem).
   - image_url: se send_image=true, pode sugerir uma; se não tiver, use a padrão.
RETORNE SOMENTE UM JSON válido com estas chaves:
{
  "phone_full": "...",
  "first_name": "...",
  "order_id": "...",
  "message": "...",
  "send_image": true/false,
  "image_url": "..."
}
Se faltar algo, preencha com defaults sensatos.
`;

  const user = `WEBHOOK JSON:\n${JSON.stringify(payload, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const body = { contents: [{ role: "user", parts: [{ text: sys + "\n\n" + user }] }] };

  try {
    const r = await axios.post(url, body, { headers: { "Content-Type": "application/json" } });
    const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    const parsed = safeJSONParse(text) || {};
    const phone = normalizePhoneE164BR(parsed.phone_full || "");
    const first = (parsed.first_name || "cliente").toString().split(/\s+/)[0];
    const orderId = parsed.order_id || "000000";
    let msg = parsed.message || "";
    const sendImage = !!parsed.send_image;
    const imageUrl = parsed.image_url || CONFIG.IMAGE_URL;

    if (!msg) {
      msg = `
Olá *${first}*, seu pedido *${orderId}* foi confirmado! 💚💗

Quer aproveitar o mesmo frete e incluir mais peças com desconto?
Use o cupom *FLZ30* — válido só hoje!

Garanta já: www.aquafitbrasil.com
      `.trim();
    }

    return {
      phone_full: phone,
      first_name: first,
      order_id: orderId,
      message: sanitizeWhatsText(msg),
      send_image: sendImage,
      image_url: imageUrl,
    };
  } catch (err) {
    console.error("❌ Erro ao chamar Gemini:", err.response?.data || err.message);
    // Fallback duro
    return {
      phone_full: null,
      first_name: "cliente",
      order_id: "000000",
      message: sanitizeWhatsText(`
Seu pedido foi confirmado! 💚💗

Aproveite o mesmo frete para incluir mais peças com desconto.
Use o cupom *FLZ30* — válido só hoje!

Garanta já: www.aquafitbrasil.com
      `),
      send_image: true,
      image_url: CONFIG.IMAGE_URL,
    };
  }
}
