import crypto from "crypto";

// ── 加密（官方格式）──────────────────────────────
// EncryptInfo = hex( base64(密文) + ":::" + base64(GCM tag) )
// HashInfo    = SHA256( key + EncryptInfo + iv )（大寫 hex）

export interface EncryptResult {
  EncryptInfo: string;
  HashInfo: string;
}

export function encryptPayuni(data: Record<string, string | number | boolean>): EncryptResult {
  const merKey = process.env.PAYUNI_HASH_KEY || "";
  const merIV  = process.env.PAYUNI_HASH_IV  || "";

  const key = merKey;
  const iv  = Buffer.from(merIV);

  // encodeURIComponent 等同 querystring.stringify，Next.js 環境相容
  const plaintext = Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  console.log("PlainText:", plaintext);

  // AES-256-GCM 加密
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let cipherText = cipher.update(plaintext, "utf8", "base64");
  cipherText += cipher.final("base64");
  const tag = cipher.getAuthTag().toString("base64");

  // 組合：hex( base64密文 + ":::" + base64tag )
  const EncryptInfo = Buffer.from(`${cipherText}:::${tag}`)
    .toString("hex")
    .trim();

  // HashInfo = SHA256( key + EncryptInfo + iv )，大寫
  const HashInfo = crypto
    .createHash("sha256")
    .update(`${merKey}${EncryptInfo}${merIV}`)
    .digest("hex")
    .toUpperCase();

  return { EncryptInfo, HashInfo };
}

// ── 解密（官方格式）──────────────────────────────
export function decryptPayuni(encryptStr: string): Record<string, string> {
  const merKey = process.env.PAYUNI_HASH_KEY || "";
  const merIV  = process.env.PAYUNI_HASH_IV  || "";

  const iv = Buffer.from(merIV);

  // hex 解碼後以 ::: 分割
  const [encryptData, tag] = Buffer.from(encryptStr, "hex")
    .toString()
    .split(":::");

  const decipher = crypto.createDecipheriv("aes-256-gcm", merKey, iv);
  decipher.setAuthTag(Buffer.from(tag, "base64"));

  let decipherText = decipher.update(encryptData, "base64", "utf8");
  decipherText += decipher.final("utf8");

  return Object.fromEntries(new URLSearchParams(decipherText)) as Record<string, string>;
}

// ── Endpoint ──────────────────────────────────────
export function getPayuniEndpoint(): string {
  return process.env.PAYUNI_ENV === "production"
    ? "https://api.payuni.com.tw/api/upp"
    : "https://sandbox-api.payuni.com.tw/api/upp";
}
