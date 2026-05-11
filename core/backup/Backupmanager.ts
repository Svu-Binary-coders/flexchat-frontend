"use client";

import { WORDLIST } from "./wordList";

const subtle = () => window.crypto.subtle;
const rand = (n: number) => window.crypto.getRandomValues(new Uint8Array(n));
const textEnc = (s: string) => new TextEncoder().encode(s);

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

//  AES-GCM encrypt / decrypt
async function aesEncrypt(
  key: CryptoKey,
  data: Uint8Array,
): Promise<{ ctB64: string; ivB64: string }> {
  const iv = rand(12);
  const ct = await subtle().encrypt(
    { name: "AES-GCM", iv: iv as unknown as BufferSource },
    key,
    data as unknown as BufferSource,
  );
  return { ctB64: b64e(ct), ivB64: b64e(iv) };
}

async function aesDecrypt(
  key: CryptoKey,
  ctB64: string,
  ivB64: string,
): Promise<Uint8Array> {
  const plain = await subtle().decrypt(
    { name: "AES-GCM", iv: b64d(ivB64) as unknown as BufferSource },
    key,
    b64d(ctB64) as unknown as BufferSource,
  );
  return new Uint8Array(plain);
}

//  Key import helpers
async function importAesKey(
  raw: Uint8Array,
  usages: KeyUsage[],
): Promise<CryptoKey> {
  return subtle().importKey(
    "raw",
    raw as unknown as BufferSource,
    { name: "AES-GCM" },
    true, // extractable - backup key -> requirement for re-encryption during PIN change
    usages,
  );
}

async function exportAesKey(key: CryptoKey): Promise<Uint8Array> {
  return new Uint8Array(await subtle().exportKey("raw", key));
}

// HKDF key import helper - all usages allowed because we only use it for ChatKeys, which are used as HKDF output and only for encrypt/decrypt
async function importHkdfKey(raw: Uint8Array): Promise<CryptoKey> {
  return subtle().importKey(
    "raw",
    raw as unknown as BufferSource,
    "HKDF",
    false, // not extractable - ChatKeys are derived from BackupKey and never re-encrypted, so we don't need to export them
    ["deriveKey", "deriveBits"],
  );
}
// HKDF output is not directly usable as AES key - we have to import it as an HKDF key and then derive an AES key from it when we want to use it for encryption. This is a bit less efficient but much simpler than trying to do HKDF ourselves in JS and also allows us to keep the raw ChatKey bits secret (never exposed outside of the CryptoKey) until we actually need to use them for encryption/decryption, which is a better security practice.

const FIXED_PHRASE_SALT = "FCP-BACKUP-PHRASE-SALT-V1";

//  256 unique words

//  24 random bytes → phrase
function bytesToPhrase(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => WORDLIST[b])
    .join(" ");
}

//  phrase → deterministic 32-byte raw key
async function phraseToRawBytes(phrase: string): Promise<Uint8Array> {
  const phraseKey = await subtle().importKey(
    "raw",
    textEnc(phrase.trim().toLowerCase()) as unknown as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await subtle().deriveBits(
    {
      name: "PBKDF2",
      salt: textEnc(FIXED_PHRASE_SALT) as unknown as BufferSource,
      iterations: 310_000,
      hash: "SHA-256",
    },
    phraseKey,
    256,
  );
  return new Uint8Array(bits);
}

//  phrase validate
function _validatePhrase(phrase: string): {
  valid: boolean;
  invalidWords: string[];
} {
  const words = phrase.trim().toLowerCase().split(/\s+/);
  const invalidWords = words.filter(
    (w) => !(WORDLIST as readonly string[]).includes(w),
  );
  return {
    valid: words.length === 24 && invalidWords.length === 0,
    invalidWords,
  };
}

//
// Public Types
//

export interface EncryptedBackupKey {
  ctB64: string; // rawBackupBytes encrypted with MasterKey
  ivB64: string;
}

export interface EncryptedChatKey {
  chatId: string;
  ctB64: string; // ChatKey raw bits encrypted with BackupKey
  ivB64: string;
}

//
// BackupManager
//

export class BackupManager {
  //
  // createBackupKey
  // Registration এ একবার call করো
  //

  static async createBackupKey(masterKey: CryptoKey): Promise<{
    backupKey: CryptoKey;
    recoveryPhrase: string;
    encBackupKey: EncryptedBackupKey;
  }> {
    // 1. 24 random bytes → phrase
    const phraseBytes = rand(24);
    const recoveryPhrase = bytesToPhrase(phraseBytes);

    // 2. phrase → rawBackupBytes (deterministic — recovery এ same আসবে)
    const rawBackupBytes = await phraseToRawBytes(recoveryPhrase);

    // 3. rawBackupBytes → BackupKey
    const backupKey = await importAesKey(rawBackupBytes, [
      "encrypt",
      "decrypt",
      "wrapKey",
      "unwrapKey",
    ]);

    // 4. rawBackupBytes → MasterKey দিয়ে encrypt → server এ save করো
    //    normal login এ phrase PBKDF2 এড়ানো যাবে (fast unlock)
    const encBackupKey = await aesEncrypt(masterKey, rawBackupBytes);

    return { backupKey, recoveryPhrase, encBackupKey };
  }

  //
  // restoreBackupKey
  // Normal Login এ — PIN আছে, server থেকে encBackupKey এনে decrypt করো
  //

  static async restoreBackupKey(
    masterKey: CryptoKey,
    encBackupKey: EncryptedBackupKey,
  ): Promise<CryptoKey> {
    const rawBackupBytes = await aesDecrypt(
      masterKey,
      encBackupKey.ctB64,
      encBackupKey.ivB64,
    );
    return importAesKey(rawBackupBytes, [
      "encrypt",
      "decrypt",
      "wrapKey",
      "unwrapKey",
    ]);
  }

  //
  // recoverFromPhrase
  // PIN ভুলে গেলে — Phrase দিয়ে BackupKey directly recover করো
  //
  //
  // আগের version এ rand(32) ব্যবহার করছিল — সেটা ভুল ছিল।
  // এখন phrase → PBKDF2 → same rawBackupBytes → same BackupKey।
  // Server লাগে না।

  static async recoverFromPhrase(
    recoveryPhrase: string,
    newMasterKey: CryptoKey,
  ): Promise<{
    backupKey: CryptoKey;
    newEncBackupKey: EncryptedBackupKey;
  }> {
    // 1. Validate
    const { valid, invalidWords } = _validatePhrase(recoveryPhrase);
    if (!valid) {
      throw new Error(
        invalidWords.length > 0
          ? `ভুল word: ${invalidWords.slice(0, 3).join(", ")}`
          : "Recovery phrase অবশ্যই 24 word হতে হবে",
      );
    }

    // 2. phrase → rawBackupBytes (registration এর মতো same result)
    const rawBackupBytes = await phraseToRawBytes(recoveryPhrase);

    // 3. BackupKey বানাও
    const backupKey = await importAesKey(rawBackupBytes, [
      "encrypt",
      "decrypt",
      "wrapKey",
      "unwrapKey",
    ]);

    // 4. নতুন MasterKey দিয়ে re-encrypt → server এ update করো
    const newEncBackupKey = await aesEncrypt(newMasterKey, rawBackupBytes);

    return { backupKey, newEncBackupKey };
  }

  //
  // backupChatKeyRaw
  // নতুন chat শুরু হলে — ChatKey এর raw bits backup করো
  //
  //
  // HKDF key directly export করা যায় না।
  // SessionManager.deriveChatKeyHKDF কে modify করো যাতে raw bits ও return করে।
  // সেই raw bits এখানে দাও।

  static async backupChatKeyRaw(
    backupKey: CryptoKey,
    rawChatKeyBits: Uint8Array, // 32 bytes — HKDF derivation output
    chatId: string,
  ): Promise<EncryptedChatKey> {
    const { ctB64, ivB64 } = await aesEncrypt(backupKey, rawChatKeyBits);
    return { chatId, ctB64, ivB64 };
  }

  //
  // restoreAllChatKeys
  // Login এ — server থেকে সব encChatKey নামিয়ে restore করো
  //

  static async restoreAllChatKeys(
    backupKey: CryptoKey,
    encChatKeys: EncryptedChatKey[],
  ): Promise<Map<string, CryptoKey>> {
    const chatKeyMap = new Map<string, CryptoKey>();

    await Promise.all(
      encChatKeys.map(async ({ chatId, ctB64, ivB64 }) => {
        const rawBits = await aesDecrypt(backupKey, ctB64, ivB64);
        const chatKey = await importHkdfKey(rawBits);
        chatKeyMap.set(chatId, chatKey);
      }),
    );

    return chatKeyMap;
  }

  //
  // reEncryptBackupKey
  // PIN change হলে — BackupKey same, শুধু নতুন MasterKey দিয়ে re-wrap
  //

  static async reEncryptBackupKey(
    backupKey: CryptoKey,
    newMasterKey: CryptoKey,
  ): Promise<EncryptedBackupKey> {
    const rawBytes = await exportAesKey(backupKey);
    return aesEncrypt(newMasterKey, rawBytes);
  }

  //
  // verifyPhrase
  // Registration এ user phrase confirm করলে — wordlist check
  //

  static verifyPhrase(phrase: string): {
    valid: boolean;
    invalidWords: string[];
  } {
    return _validatePhrase(phrase);
  }

  //
  // phraseToBackupKey
  // Recovery page এ standalone — শুধু ChatKey restore করতে চাইলে
  //

  static async phraseToBackupKey(recoveryPhrase: string): Promise<CryptoKey> {
    const { valid, invalidWords } = _validatePhrase(recoveryPhrase);
    if (!valid) {
      throw new Error(
        invalidWords.length > 0
          ? `ভুল word: ${invalidWords.slice(0, 3).join(", ")}`
          : "24-word phrase দরকার",
      );
    }
    const rawBytes = await phraseToRawBytes(recoveryPhrase);
    return importAesKey(rawBytes, [
      "encrypt",
      "decrypt",
      "wrapKey",
      "unwrapKey",
    ]);
  }
}
