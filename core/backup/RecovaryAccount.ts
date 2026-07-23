import { KeyManager } from "../e2e";
import { BackupManager, EncryptedChatKey } from "./Backupmanager";
import api from "@/lib/axios";
interface BackupData {
  publicKey64: string;
  saltB64: string;
  encBackupKey: {
    ctB64: string;
    ivB64: string;
  };
  isMFAEnabled: boolean;
  identityBackup: {
    encPrivKeyB64: string;
    privKeyIvB64: string;
    sigKeyB64: string;
    sigKeyIvB64: string;
  };
}
async function fetchBackupDataFromServer(userId: string): Promise<BackupData> {
  const { data } = await api.get(`/backup/${userId}`);
  if (!data.success) {
    throw new Error("Failed to fetch backup data");
  }
  return data.backupData;
}

async function updateServerBackupKey(
  userId: string,
  encBackupKey: { ctB64: string; ivB64: string },
  saltB64: string,
): Promise<void> {
  const { data } = await api.post(`/backup/${userId}/update-backup-key`, {
    encBackupKey,
    saltB64,
  });
  if (!data.success) {
    throw new Error("Failed to update backup key on server");
  }
}

async function fetchEncryptedChatKeysFromServer(
  userId: string,
): Promise<EncryptedChatKey[]> {
  const { data } = await api.get(`/backup/${userId}/chat-keys`);
  if (!data.success) {
    throw new Error("Failed to fetch chat keys");
  }
  return data.chatKeys;
}

//
// Step 1 — verify the recovery phrase
// UI calls this first. Any wrong word / wrong phrase surfaces as a thrown
// Error the form can show inline. Nothing is written to the server yet.
//
export interface VerifiedRecovery {
  backupKey: CryptoKey;
  backupData: BackupData;
  privateKey: CryptoKey;
  signingKey: CryptoKey;
}

export async function verifyRecoveryPhrase(
  userId: string,
  recoveryPhrase: string,
): Promise<VerifiedRecovery> {
  const { valid, invalidWords } = BackupManager.verifyPhrase(recoveryPhrase);
  if (!valid) {
    throw new Error(
      invalidWords.length > 0
        ? `Wrong word(s): ${invalidWords.slice(0, 3).join(", ")}`
        : "Recovery phrase must be 24 words",
    );
  }

  const backupKey = await BackupManager.phraseToBackupKey(recoveryPhrase);
  const backupData = await fetchBackupDataFromServer(userId);

  let privateKey: CryptoKey;
  let signingKey: CryptoKey;

  try {
    privateKey = await KeyManager.unwrapKey(
      backupKey,
      backupData.identityBackup.encPrivKeyB64,
      backupData.identityBackup.privKeyIvB64,
      { name: "ECDH", namedCurve: "P-384" },
      "pkcs8",
      ["deriveKey", "deriveBits"],
    );

    signingKey = await KeyManager.unwrapKey(
      backupKey,
      backupData.identityBackup.sigKeyB64,
      backupData.identityBackup.sigKeyIvB64,
      { name: "HMAC", hash: "SHA-256" },
      "raw",
      ["sign", "verify"],
    );
  } catch {
    throw new Error("Recovery phrase does not match this account.");
  }

  return { backupKey, backupData, privateKey, signingKey };
}

//
// Step 2 — set a new PIN, re-wrap everything locally, upload the new
// encrypted BackupKey, and restore chat keys.
//
export async function completeRecovery(
  userId: string,
  newPin: string,
  recoveryPhrase: string,
  verified: VerifiedRecovery,
): Promise<{ chatKeyMap: Map<string, CryptoKey> }> {
  const { backupKey, backupData, privateKey, signingKey } = verified;

  const newSaltB64 = KeyManager.generateSalt();
  const newMasterKey = await KeyManager.deriveMasterKey(newPin, newSaltB64);

  const { encKeyB64: encPrivKeyB64, ivB64: privKeyIvB64 } =
    await KeyManager.wrapKey(newMasterKey, privateKey, "pkcs8");
  const { encKeyB64: sigKeyB64, ivB64: sigKeyIvB64 } = await KeyManager.wrapKey(
    newMasterKey,
    signingKey,
    "raw",
  );

  const identity = {
    userId,
    publicKeyB64: backupData.publicKey64,
    encPrivKeyB64,
    privKeyIvB64,
    saltB64: newSaltB64,
    sigKeyB64,
    sigKeyIvB64,
  };
  await KeyManager._idbSet(`fcp_identity_${userId}`, identity);
  await KeyManager.saveActiveKeys(userId, privateKey, signingKey);

  const { newEncBackupKey } = await BackupManager.recoverFromPhrase(
    recoveryPhrase,
    newMasterKey,
  );
  await updateServerBackupKey(userId, newEncBackupKey, newSaltB64);

  const encChatKeys = await fetchEncryptedChatKeysFromServer(userId);
  const chatKeyMap = await BackupManager.restoreAllChatKeys(
    backupKey,
    encChatKeys,
  );

  return { chatKeyMap };
}
