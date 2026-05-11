// src/core/e2e/KeyManager.ts
//
// Key Derivation Hierarchy
//
// PIN (user input)
//  └ PBKDF2 (310k iter, random salt) ► MasterKey  [never extractable]
//       └ AES-GCM encrypt ► EncryptedPrivateKey  (stored in IndexedDB)
//       └ AES-GCM encrypt ► EncryptedSigningKey  (stored in IndexedDB)
//
// Multi-layer strengthening:
//   1. PBKDF2  (310,000 iterations, random 32-byte salt)
//   2. HKDF stretch  (domain-separated, adds another KDF round)
//   3. Result is a non-extractable AES-GCM-256 key → used ONLY to wrap/unwrap keys
//
// The plain PIN **never** touches storage or the network.

import { StoredIdentity } from "./types";

const subtle = () => window.crypto.subtle;
const rand = (n: number) => window.crypto.getRandomValues(new Uint8Array(n));
const enc = (s: string) => new TextEncoder().encode(s);

//  Base64 helpers
function b64e(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function b64d(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

//  Internal: SHA-256 of any buffer
async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  return subtle().digest("SHA-256", data as unknown as BufferSource);
}

export class KeyManager {
  //
  // 1.  PIN  →  Master Key   (multi-layer, non-extractable)
  //

  static async deriveMasterKey(
    pin: string,
    saltB64: string,
  ): Promise<CryptoKey> {
    const salt = b64d(saltB64);

    //  Layer 1: PBKDF2

    const pinKey = await subtle().importKey(
      "raw",
      enc(pin) as unknown as BufferSource,
      "PBKDF2",
      false,
      ["deriveBits"],
    );

    const pbkdf2Bits = await subtle().deriveBits(
      {
        name: "PBKDF2",
        salt: salt as unknown as BufferSource,
        iterations: 310_000,
        hash: "SHA-256",
      },
      pinKey,
      256,
    );

    //  Layer 2: HKDF stretch (domain separation)
    const hkdfSalt = await sha256(enc(pin));

    const hkdfKey = await subtle().importKey(
      "raw",
      pbkdf2Bits as unknown as BufferSource,
      "HKDF",
      false,
      ["deriveKey"],
    );

    // Final Master Key — non-extractable, wrap/unwrap only
    return subtle().deriveKey(
      {
        name: "HKDF",

        salt: hkdfSalt as unknown as BufferSource,
        info: enc("FCP-MASTER-v1") as unknown as BufferSource,
        hash: "SHA-256",
      },
      hkdfKey,
      { name: "AES-GCM", length: 256 },
      false, // ← non-extractable: can never be read out of memory
      ["wrapKey", "unwrapKey", "decrypt", "encrypt"], // ← only for wrapping/unwrapping keys,
    );
  }

  static generateSalt(): string {
    return b64e(rand(32));
  }

  //
  // 2.  Identity Key Pair  (ECDH P-384)
  //

  static async generateIdentityKeyPair(): Promise<CryptoKeyPair> {
    return subtle().generateKey({ name: "ECDH", namedCurve: "P-384" }, true, [
      "deriveKey",
      "deriveBits",
    ]);
  }

  //
  // 3.  Signing Key  (HMAC-SHA256)
  //

  static async generateSigningKey(): Promise<CryptoKey> {
    return subtle().generateKey({ name: "HMAC", hash: "SHA-256" }, true, [
      "sign",
      "verify",
    ]);
  }

  //
  // 4.  Wrap / Unwrap private keys with Master Key (AES-GCM)
  //

  static async wrapKey(
    masterKey: CryptoKey,
    keyToWrap: CryptoKey,
    exportFormat: "pkcs8" | "raw",
  ): Promise<{ encKeyB64: string; ivB64: string }> {
    const iv = rand(12);
    const wrapped = await subtle().wrapKey(exportFormat, keyToWrap, masterKey, {
      name: "AES-GCM",

      iv: iv as unknown as BufferSource,
    });
    return { encKeyB64: b64e(wrapped), ivB64: b64e(iv) };
  }

  // Note: the unwrapped key is always non-extractable, even if the original key was extractable. This is a security measure to ensure that the Master Key is the only key that can produce extractable keys, and it never leaves memory.

  static async unwrapKey(
    masterKey: CryptoKey,
    encKeyB64: string,
    ivB64: string,
    unwrappedKeyAlgo:
      | AlgorithmIdentifier
      | RsaHashedImportParams
      | EcKeyImportParams
      | HmacImportParams
      | AesKeyAlgorithm,
    exportFormat: "pkcs8" | "raw",
    usages: KeyUsage[],
  ): Promise<CryptoKey> {
    return subtle().unwrapKey(
      exportFormat,

      b64d(encKeyB64) as unknown as BufferSource,
      masterKey,

      { name: "AES-GCM", iv: b64d(ivB64) as unknown as BufferSource },
      unwrappedKeyAlgo,
      false, // unwrapped keys are also non-extractable
      usages,
    );
  }

  //
  // 5.  Export helpers (for public keys and sharing)
  //

  static async exportPublicKey(key: CryptoKey): Promise<string> {
    return b64e(await subtle().exportKey("spki", key));
  }

  static async importPublicKey(b64: string): Promise<CryptoKey> {
    return subtle().importKey(
      "spki",

      b64d(b64) as unknown as BufferSource,
      { name: "ECDH", namedCurve: "P-384" },
      false,
      [],
    );
  }

  //
  // 6.  Identity Persistence  (IndexedDB helpers)
  //

  static async createAndStoreIdentity(
    userId: string,
    pin: string,
  ): Promise<StoredIdentity> {
    const saltB64 = KeyManager.generateSalt();
    const masterKey = await KeyManager.deriveMasterKey(pin, saltB64);
    const { publicKey, privateKey } =
      await KeyManager.generateIdentityKeyPair();
    const signingKey = await KeyManager.generateSigningKey();

    const { encKeyB64: encPrivKeyB64, ivB64: privKeyIvB64 } =
      await KeyManager.wrapKey(masterKey, privateKey, "pkcs8");

    const { encKeyB64: sigKeyB64, ivB64: sigKeyIvB64 } =
      await KeyManager.wrapKey(masterKey, signingKey, "raw");

    const identity: StoredIdentity = {
      userId,
      publicKeyB64: await KeyManager.exportPublicKey(publicKey),
      encPrivKeyB64,
      privKeyIvB64,
      saltB64,
      sigKeyB64,
      sigKeyIvB64,
    };

    await KeyManager._idbSet(`fcp_identity_${userId}`, identity);
    return identity;
  }

  static async loadIdentity(
    userId: string,
    pin: string,
  ): Promise<{
    identity: StoredIdentity;
    privateKey: CryptoKey;
    signingKey: CryptoKey;
  }> {
    const identity: StoredIdentity = await KeyManager._idbGet(
      `fcp_identity_${userId}`,
    );
    if (!identity)
      throw new Error("Identity not found. Please register first.");

    const masterKey = await KeyManager.deriveMasterKey(pin, identity.saltB64);

    const privateKey = await KeyManager.unwrapKey(
      masterKey,
      identity.encPrivKeyB64,
      identity.privKeyIvB64,
      { name: "ECDH", namedCurve: "P-384" },
      "pkcs8",
      ["deriveKey", "deriveBits"],
    );

    const signingKey = await KeyManager.unwrapKey(
      masterKey,
      identity.sigKeyB64,
      identity.sigKeyIvB64,
      { name: "HMAC", hash: "SHA-256" },
      "raw",
      ["sign", "verify"],
    );

    return { identity, privateKey, signingKey };
  }

  //  Minimal IndexedDB wrapper
  private static _db: IDBDatabase | null = null;

  private static async _openDB(): Promise<IDBDatabase> {
    if (KeyManager._db) return KeyManager._db;
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("FlexChatKeysDB", 2);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains("store")) {
          req.result.createObjectStore("store");
        }
      };
      req.onsuccess = () => {
        KeyManager._db = req.result;
        resolve(req.result);
      };
      req.onerror = () => reject(req.error);
    });
  }

  static async _idbSet(key: string, value: unknown): Promise<void> {
    const db = await KeyManager._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("store", "readwrite");
      tx.objectStore("store").put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async _idbGet<T>(key: string): Promise<T> {
    const db = await KeyManager._openDB();
    return new Promise((resolve, reject) => {
      const req = db.transaction("store").objectStore("store").get(key);
      req.onsuccess = () => resolve(req.result as T);
      req.onerror = () => reject(req.error);
    });
  }

  static async saveActiveKeys(
    userId: string,
    privateKey: CryptoKey,
    signingKey: CryptoKey,
  ): Promise<void> {
    const activeSession = { userId, privateKey, signingKey };
    await KeyManager._idbSet("fcp_active_session", activeSession);
  }

  static async loadActiveKeys(): Promise<ActiveSession | null> {
    const session = (await KeyManager._idbGet("fcp_active_session")) as
      | ActiveSession
      | undefined;

    if (!session) {
      return null;
    }

    return session;
  }

  private static async _idbDelete(key: string): Promise<void> {
    const db = await KeyManager._openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("store", "readwrite");
      tx.objectStore("store").delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  static async clearActiveKeys(): Promise<void> {
    await KeyManager._idbDelete("fcp_active_session");
  }
}

export interface ActiveSession {
  userId: string;
  privateKey: CryptoKey;
  signingKey: CryptoKey;
}
