import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

const normalizeKey = () => {
  const configured = process.env.SOCIAL_TOKEN_ENCRYPTION_KEY?.trim();
  if (configured) {
    return createHash("sha256").update(configured).digest();
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("SOCIAL_TOKEN_ENCRYPTION_KEY must be configured in production.");
  }

  // Development fallback only. Always set SOCIAL_TOKEN_ENCRYPTION_KEY in production.
  return createHash("sha256").update("local-dev-social-token-key").digest();
};

export function encryptSecret(value: string): string {
  const iv = randomBytes(IV_LENGTH);
  const key = normalizeKey();
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf-8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64url")}.${encrypted.toString("base64url")}.${tag.toString("base64url")}`;
}

export function decryptSecret(payload: string): string {
  const [ivPart, dataPart, tagPart] = payload.split(".");
  if (!ivPart || !dataPart || !tagPart) {
    throw new Error("Invalid encrypted token payload.");
  }

  const key = normalizeKey();
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf-8");
}
