import { FCPEngine, SessionManager, KeyManager, FCPVersion } from "@/core/e2e";
import { useSessionStore } from "@/stores/sessionStore";

async function ensureKeys() {
  let { privateKey, signingKey } = useSessionStore.getState();

  //   if can not find keys in store, try loading from IndexedDB (KeyManager) and update the store
  if (!privateKey || !signingKey) {
    console.log(
      "Keys not found in store, attempting to load from KeyManager...",
    );
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
      console.error("Some error to seeing the keys", error);
    }
  }

  return { privateKey, signingKey };
}

// encrypt msg fn
export async function secureEncryptMessage(
  text: string,
  chatId: string,
  friendPublicKey: string,
  type: "text" | "image" | "file" = "text",
  options?: {
    version?: FCPVersion;
    conditions?: string;
    isForwarded?: boolean;
    isBlur?: boolean;
    isViewOnce?: boolean;
    currentForwardCount?: number;
  },
): Promise<string | null> {
  try {
    const { privateKey, signingKey } = await ensureKeys();
    if (!privateKey || !signingKey) return null;

    const { getChatKey } = await SessionManager.bootstrapSession(
      privateKey,
      friendPublicKey,
    );
    const chatKey = await getChatKey(chatId);

    // Encrypt the message using FCPEngine
    const encryptedContent = await FCPEngine.encryptMessage({
      text: text,
      type: type,
      chatId: chatId,
      chatKey: chatKey,
      signingKey: signingKey,
      options: {
        isForwarded: options?.isForwarded ?? false,
        isBlur: options?.isBlur ?? false,
        isViewOnce: options?.isViewOnce ?? false,
        conditions: options?.conditions ?? "NONE",
        version: options?.version ?? FCPVersion.V1,
        currentForwardCount: options?.currentForwardCount ?? 0,
      },
    });

    return encryptedContent;
  } catch (error) {
    console.error("Encryption failed:", error);
    return null;
  }
}

// decrypt msg fn
export async function secureDecryptMessage(
  encryptedText: string,
  chatId: string,
  senderPublicKey: string,
) {
  try {
    const { privateKey, signingKey } = await ensureKeys();
    if (!privateKey || !signingKey) throw new Error("Keys missing");

    const { getChatKey } = await SessionManager.bootstrapSession(
      privateKey,
      senderPublicKey,
    );
    const chatKey = await getChatKey(chatId);

    const decryptedMessage = await FCPEngine.decryptMessage(
      encryptedText,
      chatKey,
      signingKey,
    );

    return decryptedMessage;
  } catch (error) {
    return {
      text: "🔒 [Encrypted Message]",
      flags: { isViewOnce: false, isForwarded: false, isBlur: false },
      conditions: "NONE",
      error: true,
    };
  }
}
