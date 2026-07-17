// High-level wrapper around FlexCipher.
// Translates human-readable options (isForwarded, isBlur, isViewOnce) into
// bitwise FCP flags and calls pack/unpack on your behalf.

import { FlexCipher, PackOptions } from "./FlexCipher";
import { FCPFlags, FCPVersion, hasFlag } from "./types";


//  encryptMessage params
export interface EncryptMessageParams {
  text: string;
  type: "text" | "image" | "file";
  chatId: string;
  chatKey: CryptoKey;
  signingKey: CryptoKey;
  options?: {
    isForwarded?: boolean;
    isBlur?: boolean;
    isViewOnce?: boolean;
    conditions?: string;
    version?: FCPVersion;
    currentForwardCount?: number;
  };
}

//  decryptMessage result
export interface DecryptMessageResult {
  text: string;
  flags: {
    isForwarded: boolean;
    isBlur: boolean;
    isViewOnce: boolean;
    isHighlyForwarded: boolean;
  };
  conditions: string;
  timestamp: number;
  ttlSeconds: number | null;
  forwardCount: number;
}

export class FCPEngine {
  static async encryptMessage(params: EncryptMessageParams): Promise<string> {
    const { text, type, chatId, chatKey, signingKey, options = {} } = params;

    // Automatically increment forward count if isForwarded is true
    let newForwardCount = options.currentForwardCount || 0;
    if (options.isForwarded) {
      newForwardCount += 1;
      if (newForwardCount >= 5) newForwardCount = 5; // cap the forward count at 5 for "highly forwarded" status
    }

    //  Base flag by payload type
    let flags: number;
    if (type === "image") flags = FCPFlags.IMG;
    else if (type === "file") flags = FCPFlags.FILE;
    else flags = FCPFlags.TXT;
    if (options.isForwarded)
      flags = FlexCipher.buildFlags(flags, FCPFlags.FORWARDED);
    if (options.isBlur) flags = FlexCipher.buildFlags(flags, FCPFlags.BLUR);
    if (options.isViewOnce) flags = FlexCipher.buildFlags(flags, FCPFlags.BURN);

    return FlexCipher.packMessage({
      payload: { t: text, fc: newForwardCount },
      chatKey,
      signingKey,
      chatId,
      flags,
      version: options.version,
      conditions: options.conditions ?? "NONE",
      ttlSeconds: options.isViewOnce ? 10 : undefined,
    });
  }

  /**
   * Decrypt an incoming envelope and return a structured result.
   *
   * Throws if signature is invalid (tampered message) or conditions
   * are not met (GEO/TIME lock).
   *
   * @example
   * socket.on("receive_message", async (data) => {
   *   try {
   *     const result = await FCPEngine.decryptMessage(
   *       data.content,
   *       myChatKey,
   *       peerSigningKey
   *     );
   *
   *     if (result.flags.isBlur)      //applyBlur(result.text);
   *     if (result.flags.isForwarded) //can not forward();
   *     if (result.flags.isViewOnce)  //startBurnTimer(result.ttlSeconds);
   *
   *   } catch (err) {
   *     console.error("Tampered or locked message:", err);
   *   }
   * });
   */
  static async decryptMessage(
    envelope: string,
    chatKey: CryptoKey,
    signingKey: CryptoKey,
    duressPin?: string,
  ): Promise<DecryptMessageResult> {
    // Throws on sig failure, condition failure, or wrong key — never silently fails
    const result = await FlexCipher.unpackMessage({
      envelope,
      chatKey,
      signingKey,
      duressPin,
    });

    const count = result.payload.fc || 0;
    return {
      text: result.payload.t,
      flags: {
        isForwarded: hasFlag(result.flags, FCPFlags.FORWARDED),
        isBlur: hasFlag(result.flags, FCPFlags.BLUR),
        isViewOnce: hasFlag(result.flags, FCPFlags.BURN),
        isHighlyForwarded: count >= 5, // "Highly forwarded" if forward count is 5 or more
      },
      conditions: result.conditions,
      timestamp: result.timestamp,
      ttlSeconds: result.ttlSeconds,
      forwardCount: count,
    };
  }
}
