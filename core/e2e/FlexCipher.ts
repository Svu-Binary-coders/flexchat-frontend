//
// Envelope wire format (8 segments, colon-separated):
//   version : flags : conditions : chatId : timestamp : iv : ciphertext : signature
//   [0]       [1]    [2]          [3]      [4]         [5]  [6]          [7]
//
// Signature covers: timestamp + ":" + iv + ":" + ciphertext


import {
  FCPVersion,
  FCPFlags,
  FCPPayload,
  FCPUnpackResult,
  hasFlag,
} from "./types";
import { SessionManager } from "./SessionManager";

const subtle = () => window.crypto.subtle;
const enc = (s: string) => new TextEncoder().encode(s);
const rand = (n: number) => window.crypto.getRandomValues(new Uint8Array(n));

function b64e(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64d(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

//  V4 padding 
const V4_PAD_SIZE = 1024;
function pad(text: string): string {
  return text.padEnd(V4_PAD_SIZE, "\0");
}
function unpad(text: string): string {
  return text.replace(/\0+$/, "");
}

//  HMAC (Shared Signature) 
function sigData(timestamp: number, iv: string, ct: string): Uint8Array {
  return enc(`${timestamp}:${iv}:${ct}`);
}
async function getSharedMacKey(
  chatKey: CryptoKey,
  timestamp: number,
): Promise<CryptoKey> {
  const tsSalt = await subtle().digest("SHA-256", enc(String(timestamp)));
  return subtle().deriveKey(
    {
      name: "HKDF",
      salt: tsSalt as unknown as BufferSource,
      info: enc("FCP-MAC-v1"),
      hash: "SHA-256",
    },
    chatKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(
  chatKey: CryptoKey, // use chatKey instead of signingKey for HMAC , because we want the signature to be verifiable by the recipient using the same chatKey
  timestamp: number,
  iv: string,
  ct: string,
): Promise<string> {
  const sharedMacKey = await getSharedMacKey(chatKey, timestamp);
  const sig = await subtle().sign(
    "HMAC",
    sharedMacKey,
    sigData(timestamp, iv, ct) as unknown as BufferSource,
  );
  return b64e(sig);
}

async function hmacVerify(
  chatKey: CryptoKey, // use chatKey instead of signingKey for HMAC , because we want the signature to be verifiable by the recipient using the same chatKey
  timestamp: number,
  iv: string,
  ct: string,
  sigB64: string,
): Promise<boolean> {
  const sharedMacKey = await getSharedMacKey(chatKey, timestamp);
  return subtle().verify(
    "HMAC",
    sharedMacKey,
    b64d(sigB64) as unknown as BufferSource,
    sigData(timestamp, iv, ct) as unknown as BufferSource,
  );
}

//  DECOY duress-pin key 
async function duressKeyFromPin(pin: string): Promise<CryptoKey> {
  const pinKey = await subtle().importKey(
    "raw",
    enc(pin) as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle().deriveKey(
    {
      name: "PBKDF2",
      salt: enc("FCP-DECOY-SALT-v1") as unknown as BufferSource,
      iterations: 100_000,
      hash: "SHA-256",
    },
    pinKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

//  Public interfaces 
export interface PackOptions {
  payload: FCPPayload;
  chatKey: CryptoKey;
  signingKey: CryptoKey;
  chatId: string;
  version?: FCPVersion;
  flags?: number;
  conditions?: string;
  duressPin?: string;
  decoyPayload?: FCPPayload;
  ttlSeconds?: number;
}

export interface UnpackOptions {
  envelope: string;
  chatKey: CryptoKey;
  signingKey: CryptoKey; // not actually used for signing in this implementation, but kept here for potential future use or extensions
  duressPin?: string;
}

export class FlexCipher {
  //  PACK 
  static async packMessage(opts: PackOptions): Promise<string> {
    const {
      payload,
      chatKey,
      chatId,
      version = FCPVersion.V1,
      flags = FCPFlags.TXT,
      conditions = "NONE",
      duressPin,
      decoyPayload,
      ttlSeconds,
    } = opts;

    const timestamp = Date.now();
    const innerPayload: FCPPayload = { ...payload };

    if (ttlSeconds && hasFlag(flags, FCPFlags.BURN)) {
      innerPayload._ttl = ttlSeconds;
    }

    if (hasFlag(flags, FCPFlags.DECOY) && duressPin && decoyPayload) {
      const dk = await duressKeyFromPin(duressPin);
      const div = rand(12);
      const dct = await subtle().encrypt(
        { name: "AES-GCM", iv: div as unknown as BufferSource },
        dk,
        enc(JSON.stringify(decoyPayload)) as unknown as BufferSource,
      );
      innerPayload._decoy = { iv: b64e(div), ct: b64e(dct) };
    }

    let plainText = JSON.stringify(innerPayload);
    if (version === FCPVersion.V4) plainText = pad(plainText);

    const msgKey = await SessionManager.deriveMessageKey(chatKey, timestamp);

    const iv = rand(12);
    const ctBuffer = await subtle().encrypt(
      { name: "AES-GCM", iv: iv as unknown as BufferSource },
      msgKey,
      enc(plainText) as unknown as BufferSource,
    );

    const ivB64 = b64e(iv);
    const ctB64 = b64e(ctBuffer);

    // use chatKey for HMAC signing instead of signingKey, because we want the signature to be verifiable by the recipient using the same chatKey
    const signature = await hmacSign(chatKey, timestamp, ivB64, ctB64);

    return [
      version,
      flags,
      conditions,
      chatId,
      timestamp,
      ivB64,
      ctB64,
      signature,
    ].join(":");
  }

  //  UNPACK 
  static async unpackMessage(opts: UnpackOptions): Promise<FCPUnpackResult> {
    const { envelope, chatKey, duressPin } = opts;

    const parts = envelope.split(":");
    if (parts.length < 8)
      throw new Error("Invalid FCP envelope: wrong segment count");

    const [
      versionStr,
      flagsStr,
      conditions,
      chatId,
      tsStr,
      ivB64,
      ctB64,
      signature,
    ] = parts;

    const version = versionStr as FCPVersion;
    const flags = parseInt(flagsStr, 10);
    const timestamp = parseInt(tsStr, 10);

    if (!Object.values(FCPVersion).includes(version))
      throw new Error(`Unsupported FCP version: ${version}`);
    if (isNaN(flags) || isNaN(timestamp))
      throw new Error("Envelope parse error: flags or timestamp is NaN");

    // 1. Condition gate
    await FlexCipher._checkConditions(conditions);

    // 2. Signature verification (tamper detection and key mismatch)
    const valid = await hmacVerify(chatKey, timestamp, ivB64, ctB64, signature);
    if (!valid)
      throw new Error(" Signature invalid — message tampered or wrong key");

    // 3. Message key
    const msgKey = await SessionManager.deriveMessageKey(chatKey, timestamp);

    // 4. Decrypt
    const decryptedBuffer = await subtle().decrypt(
      { name: "AES-GCM", iv: b64d(ivB64) as unknown as BufferSource },
      msgKey,
      b64d(ctB64) as unknown as BufferSource,
    );

    let plainText = new TextDecoder().decode(decryptedBuffer);
    if (version === FCPVersion.V4) plainText = unpad(plainText);

    let payload: FCPPayload = JSON.parse(plainText);

    // 5. DECOY branch
    if (hasFlag(flags, FCPFlags.DECOY) && duressPin && payload._decoy) {
      try {
        const dk = await duressKeyFromPin(duressPin);
        const decoyBuffer = await subtle().decrypt(
          {
            name: "AES-GCM",
            iv: b64d(payload._decoy.iv) as unknown as BufferSource,
          },
          dk,
          b64d(payload._decoy.ct) as unknown as BufferSource,
        );
        payload = JSON.parse(new TextDecoder().decode(decoyBuffer));
      } catch {
        // Wrong duress pin -> real payload shown
        console.warn("Wrong duress pin provided, showing real message payload");
      }
    }

    const ttlSeconds = payload._ttl ?? null;
    delete payload._ttl;
    delete payload._decoy;

    return { payload, flags, conditions, chatId, timestamp, ttlSeconds };
  }

  //  Condition engine 
  private static async _checkConditions(condStr: string): Promise<void> {
    if (!condStr || condStr === "NONE") return;

    for (const clause of condStr.split(";")) {
      if (clause.startsWith("TIME")) {
        const m = clause.match(/TIME\(([^)]+)\)/);
        if (!m) throw new Error("Malformed TIME condition");
        const unlockAt = parseInt(m[1], 10);
        if (Date.now() < unlockAt)
          throw new Error(
            `⏱ Time-locked until ${new Date(unlockAt).toLocaleString()}`,
          );
      }

      if (clause.startsWith("GEO")) {
        const m = clause.match(/GEO\(([^,]+),([^,]+),([^)]+)\)/);
        if (!m) throw new Error("Malformed GEO condition");
        const [, lat, lng, radius] = m;
        const ok = await FlexCipher._geoCheck(+lat, +lng, +radius);
        if (!ok)
          throw new Error(
            " GEO lock: you are not within the allowed location",
          );
      }
    }
  }

  private static _haversine(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private static _geoCheck(
    targetLat: number,
    targetLng: number,
    radiusKm: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve(false);
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const dist = FlexCipher._haversine(
            coords.latitude,
            coords.longitude,
            targetLat,
            targetLng,
          );
          resolve(dist <= radiusKm);
        },
        () => resolve(false),
        { timeout: 6000, maximumAge: 30_000 },
      );
    });
  }

  //  Builder helpers 
  static conditions = {
    none: () => "NONE",
    time: (futureDate: Date | number) =>
      `TIME(${futureDate instanceof Date ? futureDate.getTime() : futureDate})`,
    geo: (lat: number, lng: number, km = 1) => `GEO(${lat},${lng},${km})`,
    combine: (...parts: string[]) => parts.join(";"),
  };

  static buildFlags(...flags: number[]): number {
    return flags.reduce((acc, f) => acc | f, 0);
  }
}
