//  src/hooks/useServiceWorker.ts

import { useEffect } from "react";

const TTL_HOURS = 5;

export function useServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // update check
        reg.addEventListener("updatefound", () => {
          reg.installing?.addEventListener("statechange", function () {
            if (
              this.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              console.log("[SW] New version ready");
            }
          });
        });
      })
      .catch((err) => console.error("[SW] Registration failed:", err));

    const purgeInterval = setInterval(
      () => {
        triggerPurge();
      },
      60 * 60 * 1000,
    ); // 1 hour

    return () => clearInterval(purgeInterval);
  }, []);
}

function sendSWMessage(type: string): Promise<void> {
  return new Promise((resolve) => {
    if (!navigator.serviceWorker?.controller) {
      resolve();
      return;
    }
    const channel = new MessageChannel();
    channel.port1.onmessage = () => resolve();
    navigator.serviceWorker.controller.postMessage({ type }, [channel.port2]);
    setTimeout(resolve, 3000);
  });
}

export async function triggerPurge(): Promise<void> {
  if (typeof window === "undefined") return;
  await sendSWMessage("PURGE_EXPIRED");
}

export async function clearMediaCache(): Promise<void> {
  if (typeof window === "undefined") return;
  await sendSWMessage("CLEAR_MEDIA_CACHE");
}

export async function getMediaCacheSize(): Promise<number> {
  if (!("caches" in window)) return 0;
  try {
    const cache = await caches.open("media-cache-v2");
    const keys = await cache.keys();
    return keys.length;
  } catch {
    return 0;
  }
}

export async function isMediaCached(url: string): Promise<boolean> {
  if (!("caches" in window)) return false;
  try {
    const cache = await caches.open("media-cache-v2");
    const metaCache = await caches.open("media-meta-v2");
    const cached = await cache.match(url);
    if (!cached) return false;

    const metaRes = await metaCache.match(`meta:${url}`);
    if (!metaRes) return false;

    const { cachedAt } = await metaRes.json();
    return Date.now() - cachedAt <= TTL_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
