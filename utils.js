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
  if (!raw) return null;
  const d = toDigits(raw);
  if (!d) return null;
  if (d.startsWith("55")) return d;
  if (d.startsWith("0")) return "55" + d.slice(1);
  if (d.length === 11) return "55" + d;
  return d;
}

export function sanitizeWhatsText(text) {
  if (!text) return "";
  let t = String(text);
  t = t.replace(/[\u200B-\u200D\u2060\uFEFF]/g, "").replace(/[ ]{2,}/g, " ");
  t = t.replace(/\*\*([^*\n]+)\*\*/g, "*$1*");
  t = t.replace(/https?:\/\/[^\s]+/g, (url) =>
    url.trim().replace(/\n/g, "").replace(/\s/g, "")
  );
  t = t.replace(/([^\n])(\n)([^\n])/g, "$1\n\n$3").replace(/\n{3,}/g, "\n\n");
  return t.trim();
}

export async function ensureLocalImage(imageUrl, localDir, localName) {
  ensureDir(localDir);
  const p = path.join(localDir, localName);
  if (fs.existsSync(p)) return p;
  const resp = await axios.get(imageUrl, { responseType: "arraybuffer", timeout: 20000 });
  fs.writeFileSync(p, resp.data);
  return p;
}

export function safeJSONParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}
