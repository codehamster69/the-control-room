import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const TRANSFER_INTENT_TTL_MS = 10 * 60 * 1000;

type TransferIntentPayload = {
  intentId: string;
  newOwnerId: string;
  oldOwnerId: string;
  instagramUsername: string;
  instagramAvatarUrl?: string | null;
  issuedAt: number;
  expiresAt: number;
};

function getTransferIntentSecret() {
  return process.env.INSTAGRAM_TRANSFER_INTENT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function normalizeInstagramUsername(username: string): string {
  return username.replace(/^@/, "").trim().toLowerCase();
}

export function maskEmail(email: string | undefined): string | null {
  if (!email || !email.includes("@")) {
    return null;
  }

  const [localPart, domain] = email.split("@");
  if (!localPart || !domain) {
    return null;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] || "*"}*@${domain}`;
  }

  return `${localPart[0]}${"*".repeat(Math.max(localPart.length - 2, 1))}${localPart[localPart.length - 1]}@${domain}`;
}

export function createTransferIntent(params: {
  newOwnerId: string;
  oldOwnerId: string;
  instagramUsername: string;
  instagramAvatarUrl?: string | null;
}) {
  const secret = getTransferIntentSecret();
  if (!secret) {
    throw new Error("Missing transfer intent secret");
  }

  const issuedAt = Date.now();
  const payload: TransferIntentPayload = {
    intentId: randomUUID().replace(/-/g, "").slice(0, 12),
    newOwnerId: params.newOwnerId,
    oldOwnerId: params.oldOwnerId,
    instagramUsername: normalizeInstagramUsername(params.instagramUsername),
    instagramAvatarUrl: params.instagramAvatarUrl || null,
    issuedAt,
    expiresAt: issuedAt + TRANSFER_INTENT_TTL_MS,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encodedPayload).digest("hex");

  return {
    token: `${encodedPayload}.${signature}`,
    intentId: payload.intentId,
    expiresAt: payload.expiresAt,
  };
}

export function verifyTransferIntent(token: string, userId: string): TransferIntentPayload {
  const secret = getTransferIntentSecret();
  if (!secret) {
    throw new Error("Missing transfer intent secret");
  }

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid transfer token format");
  }

  const expectedSignature = createHmac("sha256", secret).update(encodedPayload).digest("hex");
  if (signature.length !== expectedSignature.length) {
    throw new Error("Invalid transfer token signature");
  }

  const providedSignatureBuffer = Buffer.from(signature, "hex");
  const expectedSignatureBuffer = Buffer.from(expectedSignature, "hex");

  if (providedSignatureBuffer.length !== expectedSignatureBuffer.length) {
    throw new Error("Invalid transfer token signature");
  }

  const validSignature = timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer);

  if (!validSignature) {
    throw new Error("Invalid transfer token signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as TransferIntentPayload;

  if (payload.newOwnerId !== userId) {
    throw new Error("Transfer token does not match authenticated user");
  }

  if (Date.now() > payload.expiresAt) {
    throw new Error("Transfer token has expired");
  }

  return payload;
}

