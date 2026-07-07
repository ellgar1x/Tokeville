import { createHash } from "crypto";

/** SHA-256 hex of a Tokeville API key — only the hash is ever stored. */
export function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
