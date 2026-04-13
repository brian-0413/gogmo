import crypto from "crypto"

// ── URL-encoded query string（等同 PHP http_build_query）─────────────
export function httpBuildQuery(data: Record<string, string | number | boolean>): string {
  return Object.entries(data)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&")
    .replace(/%20/g, "+") // 與 PHP http_build_query 一致：空格變 +
}

// ── 加密（與 PHP SDK PayuniApi::Encrypt 完全一致）───────────────────
export interface EncryptResult {
  EncryptInfo: string
  HashInfo: string
}

export function encryptPayuni(data: Record<string, string | number | boolean>): EncryptResult {
  const merKey = process.env.PAYUNI_HASH_KEY || ""
  const merIV  = process.env.PAYUNI_HASH_IV  || ""

  // plaintext = http_build_query(all fields)
  const plaintext = httpBuildQuery(data)
  console.log("PlainText:", plaintext)

  // AES-256-GCM：IV = 空字串（等同 PHP openssl_encrypt 不傳 IV）
  const iv = Buffer.alloc(0)

  const cipher = crypto.createCipheriv("aes-256-gcm", merKey, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // EncryptInfo = bin2hex( base64(ciphertext) + ":::" + base64(tag) )
  const EncryptInfo = Buffer.concat([encrypted, Buffer.from(":::"), tag])
    .toString("hex")
    .trim()

  // HashInfo = SHA256( merKey + EncryptInfo + merIV ), 大寫
  const HashInfo = crypto
    .createHash("sha256")
    .update(`${merKey}${EncryptInfo}${merIV}`)
    .digest("hex")
    .toUpperCase()

  return { EncryptInfo, HashInfo }
}

// ── 解密（與 PHP SDK PayuniApi::Decrypt 完全一致）───────────────────
export function decryptPayuni(encryptStr: string): Record<string, string> {
  const merKey = process.env.PAYUNI_HASH_KEY || ""
  const merIV  = process.env.PAYUNI_HASH_IV  || ""

  // hex2bin 之後以 ::: 分割
  const hexBytes = Buffer.from(encryptStr, "hex")
  const [encryptDataHex, tagB64] = hexBytes.toString().split(":::")
  const encryptData = Buffer.from(encryptDataHex, "base64")
  const tag = Buffer.from(tagB64, "base64")

  // AES-256-GCM：IV = 空字串
  const iv = Buffer.alloc(0)
  const decipher = crypto.createDecipheriv("aes-256-gcm", merKey, iv)
  decipher.setAuthTag(tag)

  const decipherText = Buffer.concat([
    decipher.update(encryptData),
    decipher.final(),
  ]).toString("utf8")

  // parse_str 等價：&分隔 + decode
  const result: Record<string, string> = {}
  for (const pair of decipherText.split("&")) {
    const idx = pair.indexOf("=")
    if (idx < 0) continue
    const key = decodeURIComponent(pair.slice(0, idx))
    const val = decodeURIComponent(pair.slice(idx + 1))
    result[key] = val
  }
  return result
}

// ── Endpoint ─────────────────────────────────────────────────────
export function getPayuniEndpoint(): string {
  return process.env.PAYUNI_ENV === "production"
    ? "https://api.payuni.com.tw/api/upp"
    : "https://sandbox-api.payuni.com.tw/api/upp"
}