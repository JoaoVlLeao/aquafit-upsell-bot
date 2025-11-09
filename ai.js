// ai.js
import axios from "axios";
import { CONFIG } from "./config.js";
import { normalizePhoneE164BR, toDigits } from "./utils.js";

const SYSTEM_PROMPT = `
Você é um extrator de telefone. Receberá um JSON de webhook (qualquer fonte e formato).
Sua ÚNICA tarefa é retornar um JSON com a chave "phone_full" contendo o melhor telefone encontrado.
Regras:
- Procure por campos como phone, whatsapp, mobile, full_number, number, area_code, customer_phone etc.
- Pode recompor o número a partir de area_code + number.
- Retorne APENAS: {"phone_full": "<valor>"}
- Não inclua comentários, texto extra ou formatação.
- Aceite formatos com máscara (+55, espaços, traços, parênteses).
`;

export async function extractPhoneWithGemini(payload) {
  if (!CONFIG.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY ausente no .env");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.GEMINI_MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
  const body = {
    contents: [
      { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nPAYLOAD:\n" + JSON.stringify(payload, null, 2) }] },
    ],
  };

  try {
    const r = await axios.post(url, body, { headers: { "Content-Type": "application/json" } });
    const text = r.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "{}";
    let phone;
    try {
      const parsed = JSON.parse(text);
      phone = parsed?.phone_full;
    } catch {
      // se vier fora do formato, tenta pescar dígitos
      phone = toDigits(text);
    }
    const normalized = normalizePhoneE164BR(phone);
    return normalized;
  } catch (err) {
    console.error("❌ Erro ao chamar Gemini:", err.response?.data || err.message);
    return null;
  }
}
