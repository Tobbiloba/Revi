import { randomBytes } from "crypto";

export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}

export function validateApiKey(apiKey: string): boolean {
  return /^[a-f0-9]{64}$/.test(apiKey);
}
