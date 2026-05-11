/* eslint-disable @typescript-eslint/no-explicit-any */
import { SessionManager, KeyManager } from "@/core/e2e";
import { useSessionStore } from "@/stores/sessionStore";
import api from "@/lib/axios";
import { toast } from "sonner";

const SENDER_KEY_PREFIX = "grp_sender:";

//
// Keys
//
async function ensureKeys() {
  let { privateKey, signingKey } = useSessionStore.getState();

  if (!privateKey || !signingKey) {
    try {
      const activeKeys = await KeyManager.loadActiveKeys();
      if (activeKeys) {
        privateKey = activeKeys.privateKey;
        signingKey = activeKeys.signingKey;
        useSessionStore.getState().setSession({
          userId: activeKeys.userId || "",
          privateKey: activeKeys.privateKey,
          signingKey: activeKeys.signingKey,
          backupKey: null,
          needPin: false,
        });
      }
    } catch (error) {
      toast.error("Failed to load keys. Group encryption won't work.");
      console.error("Failed to load keys:", error);
    }
  }

  return { privateKey, signingKey };
}

//
// Uint8Array helpers
//
const safeUint8Array = (length: number): Uint8Array<ArrayBuffer> => {
  const buf = new ArrayBuffer(length);
  const arr = new Uint8Array(buf);
  crypto.getRandomValues(arr);
  return arr;
};

const toSafeUint8Array = (data: Uint8Array): Uint8Array<ArrayBuffer> => {
  const buf = new ArrayBuffer(data.length);
  new Uint8Array(buf).set(data);
  return new Uint8Array(buf);
};

//
// IndexDB helpers
//
const dbSave = async (key: string, value: unknown): Promise<void> => {
  await KeyManager._idbSet(key, value);
};

const dbGet = async (key: string): Promise<unknown | null> => {
  const result = await KeyManager._idbGet(key);
  return result ?? null;
};

const saveMyChainKey = async (
  chatId: string,
  chainKey: Uint8Array<ArrayBuffer>,
): Promise<void> => {
  await dbSave(`${SENDER_KEY_PREFIX}${chatId}:my`, {
    chainKey: Array.from(chainKey),
  });
};

const saveSenderChainKey = async (
  chatId: string,
  senderId: string,
  chainKey: Uint8Array<ArrayBuffer>,
): Promise<void> => {
  await dbSave(`${SENDER_KEY_PREFIX}${chatId}:${senderId}`, {
    chainKey: Array.from(chainKey),
  });
};

const getMyChainKey = async (
  chatId: string,
): Promise<{ chainKey: Uint8Array<ArrayBuffer> } | null> => {
  const data = (await dbGet(`${SENDER_KEY_PREFIX}${chatId}:my`)) as {
    chainKey: number[];
  } | null;
  if (!data) return null;
  return { chainKey: toSafeUint8Array(new Uint8Array(data.chainKey)) };
};

const getSenderChainKey = async (
  chatId: string,
  senderId: string,
): Promise<{ chainKey: Uint8Array<ArrayBuffer> } | null> => {
  const data = (await dbGet(`${SENDER_KEY_PREFIX}${chatId}:${senderId}`)) as {
    chainKey: number[];
  } | null;
  if (!data) return null;
  return { chainKey: toSafeUint8Array(new Uint8Array(data.chainKey)) };
};

//
// Crypto helpers
//
const deriveMessageKey = async (
  chainKey: Uint8Array<ArrayBuffer>,
): Promise<CryptoKey> => {
  const hmacKey = await crypto.subtle.importKey(
    "raw",
    chainKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    hmacKey,
    new TextEncoder().encode("msg"),
  );
  return crypto.subtle.importKey(
    "raw",
    toSafeUint8Array(new Uint8Array(sig)),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
};

const encryptChainKeyForMember = async (
  chainKey: Uint8Array<ArrayBuffer>,
  memberPublicKeyB64: string,
  myPrivateKey: CryptoKey,
  chatId: string,
): Promise<string> => {
  const { getChatKey } = await SessionManager.bootstrapSession(
    myPrivateKey,
    memberPublicKeyB64,
  );
  const hkdfKey = await getChatKey(`${chatId}:grp-key-exchange`);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("grp-chain-key-salt"),
      info: new TextEncoder().encode("grp-chain-key"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const iv = safeUint8Array(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    chainKey,
  );
  const combined = toSafeUint8Array(
    new Uint8Array([...iv, ...new Uint8Array(encrypted)]),
  );
  return btoa(String.fromCharCode(...combined));
};

const decryptChainKeyFromSender = async (
  encryptedBase64: string,
  senderPublicKeyB64: string,
  myPrivateKey: CryptoKey,
  chatId: string,
): Promise<Uint8Array<ArrayBuffer>> => {
  const { getChatKey } = await SessionManager.bootstrapSession(
    myPrivateKey,
    senderPublicKeyB64,
  );
  const hkdfKey = await getChatKey(`${chatId}:grp-key-exchange`);
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new TextEncoder().encode("grp-chain-key-salt"),
      info: new TextEncoder().encode("grp-chain-key"),
    },
    hkdfKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  const combined = toSafeUint8Array(
    Uint8Array.from(atob(encryptedBase64), (c) => c.charCodeAt(0)),
  );
  const iv = combined.slice(0, 12) as Uint8Array<ArrayBuffer>;
  const data = combined.slice(12) as Uint8Array<ArrayBuffer>;
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    data,
  );
  return toSafeUint8Array(new Uint8Array(decrypted));
};

//
// Public API
//

export const initGroupSenderKey = async (
  chatId: string,
  myId: string,
  memberPublicKeys: { userId: string; publicKey: string }[],
): Promise<void> => {
  const { privateKey } = await ensureKeys();
  if (!privateKey) throw new Error("Private key not found");

  const chainKey = safeUint8Array(32);
  await saveMyChainKey(chatId, chainKey);

  const encryptedKeys = await Promise.all(
    memberPublicKeys.map(async ({ userId, publicKey }) => ({
      recipientId: userId,
      encryptedChainKey: await encryptChainKeyForMember(
        chainKey,
        publicKey,
        privateKey,
        chatId,
      ),
    })),
  );

  await api.post(`/group/${chatId}/sender-key`, { encryptedKeys });
};

export const ensureGroupSenderKey = async (
  chatId: string,
  myId: string,
  memberPublicKeys: { userId: string; publicKey: string }[],
): Promise<void> => {
  const existing = await getMyChainKey(chatId);
  if (existing) return;
  await initGroupSenderKey(chatId, myId, memberPublicKeys);
};

export const loadGroupSenderKeys = async (
  chatId: string,
  senderPublicKeys: Map<string, string>,
): Promise<void> => {
  const { privateKey } = await ensureKeys();
  if (!privateKey) throw new Error("Private key not found");

  const { data } = await api.get(`/group/${chatId}/sender-keys`);
  if (!data?.senderKeys?.length) {
    console.warn("[LoadKeys] no sender keys from server");
    return;
  }

  await Promise.all(
    data.senderKeys.map(
      async ({
        senderId,
        encryptedChainKey,
      }: {
        senderId: string;
        encryptedChainKey: string;
      }) => {
        try {
          const senderPublicKey = senderPublicKeys.get(senderId);
          console.log(
            "[LoadKeys] senderId:",
            senderId,
            "| publicKey found:",
            !!senderPublicKey,
          );
          if (!senderPublicKey) {
            console.warn("[LoadKeys] ❌ no public key for sender:", senderId);
            return;
          }

          const chainKey = await decryptChainKeyFromSender(
            encryptedChainKey,
            senderPublicKey,
            privateKey,
            chatId,
          );
          console.log("[LoadKeys] ✅ decrypt success for:", senderId);
          await saveSenderChainKey(chatId, senderId, chainKey);
        } catch (err) {
          console.error(`[LoadKeys] ❌ FAILED for ${senderId}:`, err);
        }
      },
    ),
  );
};

export const encryptGroupMessage = async (
  content: string,
  chatId: string,
  myId: string,
): Promise<string> => {
  const state = await getMyChainKey(chatId);
  if (!state)
    throw new Error("No sender key found. Call initGroupSenderKey first.");

  const messageKey = await deriveMessageKey(state.chainKey);

  // ✅ random IV — uniqueness এখান থেকে, counter দরকার নেই
  const iv = safeUint8Array(12);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    messageKey,
    new TextEncoder().encode(content),
  );

  const combined = toSafeUint8Array(
    new Uint8Array([...iv, ...new Uint8Array(encrypted)]),
  );
  const base64 = btoa(String.fromCharCode(...combined));

  return `grp_${myId}:${base64}`;
};

export const decryptGroupMessage = async (
  encryptedContent: string,
  chatId: string,
): Promise<string> => {
  if (!encryptedContent.startsWith("grp_")) return encryptedContent;

  // format: grp_{senderId}:{base64}
  // senderId তে _ থাকতে পারে তাই lastIndexOf ব্যবহার করছি না
  // প্রথম : এর আগে সব senderId
  const colonIdx = encryptedContent.indexOf(":", 4); // "grp_" এর পরে
  if (colonIdx === -1) return "🔒 [Encrypted Message]";

  const senderId = encryptedContent.slice(4, colonIdx); // "grp_" বাদ দিয়ে
  const base64 = encryptedContent.slice(colonIdx + 1);

  console.log("[Decrypt] senderId:", senderId);

  const state = await getSenderChainKey(chatId, senderId);
  console.log(
    "[Decrypt] chain key from IndexDB:",
    state ? "✅ found" : "❌ NULL",
  );
  if (!state) return "🔒 [Encrypted Message]";

  const messageKey = await deriveMessageKey(state.chainKey);

  try {
    const combined = toSafeUint8Array(
      Uint8Array.from(atob(base64), (c) => c.charCodeAt(0)),
    );
    const iv = combined.slice(0, 12) as Uint8Array<ArrayBuffer>;
    const data = combined.slice(12) as Uint8Array<ArrayBuffer>;

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      messageKey,
      data,
    );

    return new TextDecoder().decode(decrypted);
  } catch (err) {
    console.error("[Decrypt] ❌ AES-GCM decrypt failed:", err);
    return "🔒 [Encrypted Message]";
  }
};

export const rotateGroupSenderKey = async (
  chatId: string,
  myId: string,
  newMemberPublicKeys: { userId: string; publicKey: string }[],
): Promise<void> => {
  const { privateKey } = await ensureKeys();
  if (!privateKey) throw new Error("Private key not found");

  const newChainKey = safeUint8Array(32);
  await saveMyChainKey(chatId, newChainKey);

  const encryptedKeys = await Promise.all(
    newMemberPublicKeys.map(async ({ userId, publicKey }) => ({
      recipientId: userId,
      encryptedChainKey: await encryptChainKeyForMember(
        newChainKey,
        publicKey,
        privateKey,
        chatId,
      ),
    })),
  );

  await api.post(`/group/${chatId}/sender-key`, { encryptedKeys });
};

export const isGroupEncrypted = (content: string): boolean =>
  typeof content === "string" && content.startsWith("grp_");
