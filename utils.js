// utils.js
import fs from "fs";
import path from "path";
import axios from "axios";

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function toDigits(n) {
  return String(n || "").replace(/\D/g, "");
}

export function normalizePhoneE164BR(raw) {
  const d = toDigits(raw || "");
  if (!d) return null;

  // já com 55
  if (d.startsWith("55")) {
    // 55 + DDD (2) + número (8–9) = 12–13 dígitos
    if (d.length >= 12 && d.length <= 13) return d;
    // caso venha 55 + DDD + 7–8 (corrigir: se 10/11 sem 55, tratar abaixo)
  }

  // sem 55, mas com DDD+num (10–11)
  if (d.length === 10 || d.length === 11) return "55" + d;

  // números menores (ex.: só número local) — não confiáveis
  if (d.length >= 8 && d.length < 10) return null;

  return d || null;
}

export async function ensureLocalImage(imageUrl, localDir, localName) {
  ensureDir(localDir);
  const p = path.join(localDir, localName);
  if (fs.existsSync(p)) return p;
  const resp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 });
  fs.writeFileSync(p, resp.data);
  return p;
}
