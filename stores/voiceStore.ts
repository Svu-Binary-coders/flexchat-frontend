/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";

interface VoiceState {
  isRecording: boolean;
  recordingTime: number;
  compressedAudioFile: File | null;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ file: File; duration: number } | null>;
  cancelRecording: () => void;
}

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let timerInterval: NodeJS.Timeout | null = null;

export const useVoiceStore = create<VoiceState>((set, get) => ({
  isRecording: false,
  recordingTime: 0,
  compressedAudioFile: null,

  startRecording: async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data);
      };

      mediaRecorder.onstart = () => {
        set({ isRecording: true, recordingTime: 0, compressedAudioFile: null });

        timerInterval = setInterval(() => {
          set((state) => ({ recordingTime: state.recordingTime + 1 }));
        }, 1000);
      };

      mediaRecorder.start(200);
    } catch (error) {
      console.error("Microphone permission denied:", error);
      alert("Please allow microphone access to record voice messages.");
    }
  },

  stopRecording: async () => {
    return new Promise((resolve) => {
      if (!mediaRecorder || mediaRecorder.state === "inactive") {
        resolve(null);
        return;
      }

      mediaRecorder.onstop = async () => {
        if (timerInterval) clearInterval(timerInterval);

        const rawAudioBlob = new Blob(audioChunks, { type: "audio/webm" });
        const fileName = `voice_${Date.now()}.webm`;
        const audioFile = new File([rawAudioBlob], fileName, {
          type: "audio/webm",
        });

        const finalDuration = get().recordingTime;

        set({
          isRecording: false,
          compressedAudioFile: audioFile,
        });

        mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

        resolve({ file: audioFile, duration: finalDuration });
      };
      mediaRecorder.stop();
    });
  },

  cancelRecording: () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }

    if (timerInterval) clearInterval(timerInterval);
    mediaRecorder?.stream.getTracks().forEach((track) => track.stop());

    set({ isRecording: false, recordingTime: 0, compressedAudioFile: null });
  },
}));
