/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import api from "@/lib/axios";
import { API_URL } from "@/lib/chat-helpers";
import { MessageStatus, StorageProvider } from "@/types/chat";
import { getWasmEngine, getFreshHeap } from "@/lib/wasm/index";
import { useVoiceStore } from "./voiceStore";

export type AttachmentType =
  | "image"
  | "video"
  | "audio"
  | "file"
  | "VoiceMessage";

export interface SelectedMedia {
  id: string;
  file: File;
  previewUrl: string;
  type: AttachmentType;
}

export interface UploadingMedia {
  id: string;
  type: AttachmentType;
  previewUrl: string;
  name: string;
  size: number;
  progress: number;
  done: boolean;
}

export interface Attachment {
  url: string;
  type: AttachmentType;
  name: string;
  size: number;
  mimeType: string;
  publicId?: string | null;
  path?: string | null;
  provider: StorageProvider;
  duration?: number | null;
}

export interface OptimisticPayload {
  _id: string;
  isTemp: true;
  content: string;
  attachments: Omit<Attachment, "provider">[];
  createdAt: string;
  status: MessageStatus.SENDING;
}

export interface ConfirmSuccessPayload {
  tempId: string;
  messageId: string;
  attachments: Attachment[];
  text: string;
}

//  Duration helpers

function getMediaDuration(
  file: File,
  type: "audio" | "video",
): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement(type) as
      | HTMLAudioElement
      | HTMLVideoElement;
    const url = URL.createObjectURL(file);

    const cleanup = () => {
      URL.revokeObjectURL(url);
      el.remove();
    };

    el.preload = "metadata";
    el.muted = true;
    el.src = url;

    el.addEventListener(
      "loadedmetadata",
      () => {
        const dur = el.duration;
        cleanup();
        resolve(isFinite(dur) && dur > 0 ? Math.round(dur * 10) / 10 : null);
      },
      { once: true },
    );

    el.addEventListener(
      "error",
      () => {
        cleanup();
        resolve(null);
      },
      { once: true },
    );

    setTimeout(() => {
      cleanup();
      resolve(null);
    }, 5000);
  });
}

//  WASM image compression

const compressWithWasm = async (file: File, quality = 75): Promise<File> => {
  const wasm = getWasmEngine();
  if (!wasm) {
    console.warn("Wasm Engine not ready. Returning original file.");
    return file;
  }
  try {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const inputPtr = wasm._malloc(uint8Array.length);
    let heap = getFreshHeap(wasm);
    heap.set(uint8Array, inputPtr);
    const success = wasm._process_image_wasm(
      inputPtr,
      uint8Array.length,
      quality,
    );
    if (success === 1) {
      const outPtr = wasm._get_out_data();
      const outSize = wasm._get_out_size();
      heap = getFreshHeap(wasm);
      const heapView = new Uint8Array(heap.buffer, outPtr, outSize);
      const resultBytes = new Uint8Array(outSize);
      resultBytes.set(heapView);
      wasm._free_out();
      wasm._free(inputPtr);
      return new File([resultBytes], file.name, {
        type: "image/jpeg",
        lastModified: Date.now(),
      });
    }
    wasm._free(inputPtr);
    return file;
  } catch (err) {
    console.error("Wasm compression error:", err);
    return file;
  }
};

//  XHR upload

function xhrUpload(
  url: string,
  body: FormData | File | Blob,
  onProgress?: (pct: number) => void,
  options: {
    method?: "POST" | "PUT";
    skipCredentials?: boolean;
    extraHeaders?: Record<string, string>;
  } = {},
): Promise<any> {
  const {
    method = "POST",
    skipCredentials = false,
    extraHeaders = {},
  } = options;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (!skipCredentials) xhr.withCredentials = true;
    Object.entries(extraHeaders).forEach(([k, v]) =>
      xhr.setRequestHeader(k, v),
    );
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable)
        onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({});
        }
      } else {
        let message = `Upload failed: ${xhr.status}`;
        try {
          const err = JSON.parse(xhr.responseText);
          message = err?.error?.message ?? err?.message ?? message;
        } catch {}
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(body);
  });
}

export const getSafeMimeType = (file: File): string => {
  if (file.type) return file.type;

  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  const fallbackMimeTypes: Record<string, string> = {
    js: "application/javascript",
    ts: "application/typescript",
    jsx: "text/jsx",
    tsx: "text/tsx",
    json: "application/json",
    csv: "text/csv",
    rar: "application/vnd.rar",
    txt: "text/plain",
    pdf: "application/pdf",
    zip: "application/zip",
  };
  return fallbackMimeTypes[ext] || "application/octet-stream";
};

async function uploadSingle(
  media: SelectedMedia,
  onProgress?: (pct: number) => void,
): Promise<Attachment & { provider: StorageProvider }> {
  const { file, type } = media;

  const safeMimeType = getSafeMimeType(file);

  if (type === "image") {
    const form = new FormData();
    form.append("media", file);
    const data = await xhrUpload(
      `${API_URL}/uploads/chat-image`,
      form,
      onProgress,
    );
    return {
      url: data.url,
      publicId: data.publicId,
      type: "image",
      name: file.name,
      size: file.size,
      mimeType: safeMimeType,
      provider: "cloudinary",
      path: null,
      duration: null,
    };
  }

  if (type === "video") {
    const duration = await getMediaDuration(file, "video");
    const signRes = await api.post(`${API_URL}/uploads/sign-video`, {
      fileSize: file.size,
      fileName: file.name,
    });
    const { signature, timestamp, folder, apiKey, cloudName } = signRes.data;
    const form = new FormData();
    form.append("file", file);
    form.append("signature", signature);
    form.append("timestamp", String(timestamp));
    form.append("folder", folder);
    form.append("api_key", apiKey);
    const cloudData = await xhrUpload(
      `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
      form,
      onProgress,
      { skipCredentials: true },
    );
    return {
      url: cloudData.secure_url,
      publicId: cloudData.public_id,
      type: "video",
      name: file.name,
      size: file.size,
      mimeType: safeMimeType,
      provider: "cloudinary",
      path: null,
      duration: cloudData.duration ?? duration,
    };
  }

  const fileType = type === "audio" ? "audio" : "file";
  const signRes = await api.post(`${API_URL}/uploads/sign-supabase`, {
    fileName: file.name,
    fileType,
    fileSize: Number(file.size),
  });
  const { uploadUrl, path, publicUrl } = signRes.data;

  await xhrUpload(uploadUrl, file, onProgress, {
    method: "PUT",
    skipCredentials: true,
    extraHeaders: { "Content-Type": safeMimeType },
  });

  return {
    url: publicUrl,
    path,
    type,
    name: file.name,
    size: file.size,
    mimeType: safeMimeType,
    provider: "supabase",
    publicId: null,
    duration: null,
  };
}

//  Store

const detectType = (file: File): AttachmentType => {
  const mimeType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  if (
    fileName.startsWith("voice_") ||
    mimeType.includes("webm") ||
    fileName.endsWith(".webm")
  ) {
    return "VoiceMessage";
  }

  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";

  const ext = fileName.split(".").pop() || "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext))
    return "image";
  if (["mp4", "mov", "mkv", "avi"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "aac"].includes(ext)) return "audio";

  return "file";
};

const SIZE_LIMITS: Record<AttachmentType, number> = {
  image: 10 * 1024 * 1024,
  video: 50 * 1024 * 1024,
  audio: 20 * 1024 * 1024,
  file: 30 * 1024 * 1024,
  VoiceMessage: 5 * 1024 * 1024,
};

const MAX_FILES = 5;

interface MediaState {
  selectedMedias: SelectedMedia[];
  uploadingMedias: UploadingMedia[];
  isUploading: boolean;
  uploadError: string | null;
  addFiles: (files: File[]) => Promise<{ ok: boolean; error?: string }>;
  removeFile: (id: string) => void;
  clearMedia: () => void;
  uploadAndConfirm: (
    chatId: string,
    text: string,
    onOptimistic: (msg: OptimisticPayload) => void,
    onSuccess: (data: ConfirmSuccessPayload) => void,
    onError: (tempId: string) => void,
  ) => Promise<void>;
  uploadVoice: (
    file: File,
    chatId: string,
    onOptimistic: (msg: OptimisticPayload | any) => void,
    onSuccess: (data: ConfirmSuccessPayload) => void,
    onError: (tempId: string) => void,
  ) => Promise<void>;
}

export const useMediaStore = create<MediaState>((set, get) => ({
  selectedMedias: [],
  uploadingMedias: [],
  isUploading: false,
  uploadError: null,

  addFiles: async (files) => {
    const { selectedMedias } = get();
    if (selectedMedias.length + files.length > MAX_FILES)
      return { ok: false, error: `Max ${MAX_FILES} files allowed` };

    const errors: string[] = [];
    const valid: SelectedMedia[] = [];

    for (const originalFile of files) {
      const type = detectType(originalFile);
      let processedFile = originalFile;
      if (type === "image")
        processedFile = await compressWithWasm(originalFile, 80);

      const limit = SIZE_LIMITS[type];
      if (processedFile.size > limit) {
        errors.push(
          `${processedFile.name}: too large (max ${limit / 1024 / 1024}MB)`,
        );
        continue;
      }
      valid.push({
        id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
        file: processedFile,
        previewUrl: URL.createObjectURL(processedFile),
        type,
      });
    }
    if (errors.length > 0) return { ok: false, error: errors.join(", ") };
    set((s) => ({ selectedMedias: [...s.selectedMedias, ...valid] }));
    return { ok: true };
  },

  removeFile: (id) => {
    const target = get().selectedMedias.find((m) => m.id === id);
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
    set((s) => ({
      selectedMedias: s.selectedMedias.filter((m) => m.id !== id),
    }));
  },

  clearMedia: () => {
    if (get().isUploading) return;
    get().selectedMedias.forEach((m) => {
      if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
    });
    set({ selectedMedias: [], uploadError: null, uploadingMedias: [] });
  },

  uploadAndConfirm: async (chatId, text, onOptimistic, onSuccess, onError) => {
    const { selectedMedias } = get();
    if (selectedMedias.length === 0) return;

    const snapshot = [...selectedMedias];
    const tempId = `temp_${Date.now()}`;

    onOptimistic({
      _id: tempId,
      isTemp: true,
      content: text,
      attachments: snapshot.map((m) => ({
        url: m.previewUrl,
        type: m.type,
        name: m.file.name,
        size: m.file.size,
        mimeType: getSafeMimeType(m.file),
      })),
      createdAt: new Date().toISOString(),
      status: MessageStatus.SENDING,
    });

    set({
      selectedMedias: [],
      isUploading: true,
      uploadError: null,
      uploadingMedias: snapshot.map((m) => ({
        id: m.id,
        type: m.type,
        previewUrl: m.previewUrl,
        name: m.file.name,
        size: m.file.size,
        progress: 0,
        done: false,
      })),
    });

    try {
      const uploaded = await Promise.all(
        snapshot.map((m) =>
          uploadSingle(m, (pct) => {
            const safePct = pct >= 100 ? 99 : pct;

            set((s) => ({
              uploadingMedias: s.uploadingMedias.map((u) =>
                u.id === m.id ? { ...u, progress: safePct, done: false } : u,
              ),
            }));
          }),
        ),
      );

      const confirmRes = await api.post(
        `${API_URL}/uploads/confirm-attachment`,
        {
          chatId,
          text,
          attachments: uploaded,
        },
      );

      snapshot.forEach((m) => {
        if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
      });

      set({ isUploading: false, uploadingMedias: [] });

      if (confirmRes.data.success) {
        onSuccess({
          tempId,
          messageId: confirmRes.data.messageId,
          attachments: confirmRes.data.attachments,
          text,
        });
      } else {
        onError(tempId);
      }
    } catch (error: any) {
      snapshot.forEach((m) => {
        if (m.previewUrl) URL.revokeObjectURL(m.previewUrl);
      });
      set({
        isUploading: false,
        uploadingMedias: [],
        uploadError:
          error.response?.data?.message ?? error.message ?? "Upload failed.",
      });
      onError(tempId);
    }
  },

  uploadVoice: async (file, chatId, onOptimistic, onSuccess, onError) => {
    const tempId = `temp_${Date.now()}`;
    const previewUrl = URL.createObjectURL(file);
    const mediaId = `voice_${Date.now()}`;
    const duration = useVoiceStore.getState().recordingTime;

    onOptimistic({
      _id: tempId,
      isTemp: true,
      content: "",
      attachments: [
        {
          url: previewUrl,
          type: "VoiceMessage",
          name: file.name,
          size: file.size,
          mimeType: "audio/webm",
          duration: duration,
        },
      ],
      createdAt: new Date().toISOString(),
      status: MessageStatus.SENDING,
    });

    set((state) => ({
      isUploading: true,
      uploadingMedias: [
        ...state.uploadingMedias,
        {
          id: mediaId,
          type: "audio",
          previewUrl,
          name: file.name,
          size: file.size,
          progress: 0,
          done: false,
        },
      ],
    }));

    try {
      const uploadedAtt = await uploadSingle(
        { id: mediaId, file, previewUrl, type: "audio" },
        (pct) => {
          const safePct = pct >= 100 ? 99 : pct;
          set((s) => ({
            uploadingMedias: s.uploadingMedias.map((u) =>
              u.id === mediaId ? { ...u, progress: safePct, done: false } : u,
            ),
          }));
        },
      );

      const voiceAttachment = {
        ...uploadedAtt,
        type: "VoiceMessage",
        duration: duration,
      };

      const confirmRes = await api.post(
        `${API_URL}/uploads/confirm-attachment`,
        {
          chatId,
          text: "",
          attachments: [voiceAttachment],
        },
      );

      set((s) => ({
        isUploading: s.uploadingMedias.length <= 1 ? false : s.isUploading,
        uploadingMedias: s.uploadingMedias.filter((u) => u.id !== mediaId),
      }));

      if (confirmRes.data.success) {
        onSuccess({
          tempId,
          messageId: confirmRes.data.messageId || confirmRes.data.message?._id,
          attachments: confirmRes.data.attachments ||
            confirmRes.data.message?.attachments || [uploadedAtt],
          text: "",
        });
        setTimeout(() => URL.revokeObjectURL(previewUrl), 2000);
      } else {
        onError(tempId);
      }
    } catch (error) {
      console.error("Voice upload failed:", error);
      onError(tempId);
      set((s) => ({
        isUploading: s.uploadingMedias.length <= 1 ? false : s.isUploading,
        uploadingMedias: s.uploadingMedias.filter((u) => u.id !== mediaId),
      }));
      URL.revokeObjectURL(previewUrl);
    }
  },
}));

export function useAttachmentProgress(attachmentUrl: string) {
  return useMediaStore((s) => {
    if (!attachmentUrl.startsWith("blob:")) return null;
    const match = s.uploadingMedias.find((u) => u.previewUrl === attachmentUrl);
    return match ? { progress: match.progress, done: match.done } : null;
  });
}
