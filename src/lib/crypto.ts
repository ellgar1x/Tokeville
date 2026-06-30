/**
 * AES-256-GCM encryption for sensitive values (API keys stored in the DB).
 *
 * Usage: set ENCRYPTION_KEY to a 64-char hex string (32 random bytes) in .env.local:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * If ENCRYPTION_KEY is not set, values are stored as plaintext and a warning is logged.
 * Existing plaintext values are read back without error ("enc:v1:" prefix distinguishes them).
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex) return null;
  const buf = Buffer.from(hex, "hex");
  if (buf.length !== 32) {
    console.error("[crypto] ENCRYPTION_KEY must be 64 hex chars (32 bytes).");
    return null;
  }
  return buf;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns "enc:v1:<iv>:<tag>:<ciphertext>" (all hex-encoded).
 * Falls back to returning the plaintext if ENCRYPTION_KEY is not configured.
 */
export function encryptSecret(plaintext: string): string {
  const key = getKey();
  if (!key) {
    console.warn("[crypto] ENCRYPTION_KEY not set — storing API key as plaintext. Set ENCRYPTION_KEY in .env.local for production.");
    return plaintext;
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/**
 * Decrypts a value encrypted by encryptSecret.
 * Returns the original plaintext for values not prefixed with "enc:v1:" (legacy/plaintext).
 */
export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // plaintext (legacy or no key)

  const key = getKey();
  if (!key) {
    console.error("[crypto] Encrypted secret found but ENCRYPTION_KEY is not set.");
    return "";
  }
  const rest = stored.slice(PREFIX.length).split(":");
  if (rest.length !== 3) {
    console.error("[crypto] Malformed encrypted secret — wrong segment count.");
    return "";
  }
  const [ivHex, tagHex, cipherHex] = rest;
  try {
    const decipher = createDecipheriv(ALGO, key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(cipherHex, "hex")),
      decipher.final(),
    ]);
    return plain.toString("utf8");
  } catch (e) {
    console.error("[crypto] Decryption failed:", e instanceof Error ? e.message : String(e));
    return "";
  }
}
