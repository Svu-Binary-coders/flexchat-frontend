// src/core/e2e/types.ts

export enum FCPVersion {
  V1 = "v1", // Standard E2EE — HKDF timestamp salt, per-message key
  V4 = "v4", // + Padding     — all messages padded to 1024 bytes (traffic analysis resistance)
}


//  Bitwise Flag constants
// Usage: flags = FCPFlags.BURN | FCPFlags.BLUR  ->  flags = 0b10001000 = 136
export const FCPFlags = {
  NONE: 0b00000000, // 0
  TXT: 0b00000001, // 1   — plain text
  IMG: 0b00000010, // 2   — image  (URL encrypted inside cipher)
  FILE: 0b00000100, // 4   — file   (URL encrypted inside cipher)
  BURN: 0b00001000, // 8   — view-once, wipe after read
  BIOMETRIC: 0b00010000, // 16  — WebAuthn required before render
  DECOY: 0b00100000, // 32  — plausible-deniability sub-layer
  FORWARDED: 0b01000000, // 64  — show "Forwarded" tag in UI
  BLUR: 0b10000000, // 128 — show blurred preview in UI
} as const;

export type FCPFlagValue = (typeof FCPFlags)[keyof typeof FCPFlags];

// Helper: test a single flag
export function hasFlag(flags: number, flag: number): boolean {
  return (flags & flag) !== 0;
}

//  Envelope (wire format)
// "version:flags:conditions:chatId:timestamp:iv:ciphertext:signature"
export interface FCPEnvelope {
  version: FCPVersion;
  flags: number;
  conditions: string; // "NONE" | "GEO(...)" | "TIME(...)" | "GEO(...);TIME(...)"
  chatId: string; // hex SHA-256 of sorted participant IDs
  timestamp: number; // ms since epoch — used as HKDF salt for message key
  iv: string; // base64 AES-GCM IV
  cipherText: string; // base64 AES-GCM ciphertext
  signature: string; // base64 HMAC-SHA256
}

//  Payload (inside the ciphertext)
export interface FCPPayload {
  t: string; // text content
  m?: string[]; // media URLs (IMG / FILE)
  _ttl?: number; // TTL seconds (BURN) — stripped after unpack
  fc?: number; // count of forwards (FORWARDED) — incremented by pack() if flag is set
  _decoy?: {
    // encrypted dummy layer (DECOY) — stripped after unpack
    iv: string;
    ct: string;
  };
}

//  Stored identity (IndexedDB)
export interface StoredIdentity {
  userId: string;
  publicKeyB64: string; // spki  — share openly with peers / server
  encPrivKeyB64: string; // pkcs8 — AES-GCM encrypted with Master Key
  privKeyIvB64: string; // IV used to encrypt the private key
  saltB64: string; // random 32-byte PBKDF2 salt, per-user
  sigKeyB64: string; // HMAC key — AES-GCM encrypted with Master Key
  sigKeyIvB64: string;
}

//  Unpack result
export interface FCPUnpackResult {
  payload: FCPPayload;
  flags: number;
  conditions: string;
  chatId: string;
  timestamp: number;
  ttlSeconds: number | null;
}
