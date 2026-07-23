"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  verifyRecoveryPhrase,
  completeRecovery,
} from "@/core/backup/RecovaryAccount";

type VerifiedRecovery = Awaited<ReturnType<typeof verifyRecoveryPhrase>>;

interface RecoveryFlowProps {
  userId: string;
}

export default function RecoveryFlow({ userId }: RecoveryFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [phrase, setPhrase] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState<VerifiedRecovery | null>(null);

  async function handlePhraseSubmit() {
    setError("");
    setLoading(true);
    try {
      const result = await verifyRecoveryPhrase(userId, phrase);
      setVerified(result);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit() {
    setError("");
    if (newPin.length < 6) {
      setError("PIN must be at least 6 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      setError("PINs do not match.");
      return;
    }
    if (!verified) {
      setError("Session expired. Start over.");
      setStep(1);
      return;
    }

    setLoading(true);
    try {
      await completeRecovery(userId, newPin, phrase, verified);
      router.replace("/chat");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Recovery failed.");
    } finally {
      setLoading(false);
    }
  }

  return React.createElement(
    "div",
    {
      className:
        "min-h-screen flex items-center justify-center bg-[#0B1220] px-6",
    },
    React.createElement(
      Card,
      {
        className:
          "w-full max-w-sm bg-[#121B2E] border-[#1E2A40] text-[#E6EDF5]",
      },
      React.createElement(
        CardHeader,
        { className: "space-y-1" },
        React.createElement(
          "div",
          {
            className:
              "flex items-center gap-2 text-xs font-mono text-[#00D9C0]",
          },
          step === 1
            ? React.createElement(KeyRound, { className: "h-3.5 w-3.5" })
            : React.createElement(Lock, { className: "h-3.5 w-3.5" }),
          `Step ${step} of 2`,
        ),
        React.createElement(
          CardTitle,
          { className: "text-[#E6EDF5] text-xl font-medium" },
          step === 1 ? "Recover your account" : "Set a new PIN",
        ),
        React.createElement(
          CardDescription,
          { className: "text-[#8B98AC]" },
          step === 1
            ? "Enter your 24-word recovery phrase, separated by spaces."
            : "Your phrase checked out. Choose a new PIN for this device.",
        ),
      ),
      React.createElement(
        CardContent,
        { className: "space-y-3" },
        step === 1
          ? React.createElement(
              React.Fragment,
              null,
              React.createElement(Textarea, {
                value: phrase,
                onChange: (e) =>
                  setPhrase((e.target as HTMLTextAreaElement).value),
                placeholder: "word1 word2 word3 ...",
                rows: 4,
                className:
                  "bg-[#0B1220] border-[#1E2A40] text-[#E6EDF5] placeholder:text-[#8B98AC] resize-none focus-visible:ring-[#00D9C0]",
              }),
              error
                ? React.createElement(
                    "p",
                    { className: "text-sm text-[#E24B4A]" },
                    error,
                  )
                : null,
              React.createElement(
                Button,
                {
                  onClick: handlePhraseSubmit,
                  disabled: loading || phrase.trim().length === 0,
                  className:
                    "w-full bg-[#00D9C0] text-[#04342C] hover:bg-[#00D9C0]/90",
                },
                loading
                  ? React.createElement(Loader2, {
                      className: "h-4 w-4 animate-spin",
                    })
                  : null,
                loading ? "Verifying..." : "Continue",
              ),
            )
          : React.createElement(
              React.Fragment,
              null,
              React.createElement(Input, {
                type: "password",
                inputMode: "numeric",
                value: newPin,
                onChange: (e) =>
                  setNewPin((e.target as HTMLInputElement).value),
                placeholder: "New PIN",
                className:
                  "bg-[#0B1220] border-[#1E2A40] text-[#E6EDF5] placeholder:text-[#8B98AC] focus-visible:ring-[#00D9C0]",
              }),
              React.createElement(Input, {
                type: "password",
                inputMode: "numeric",
                value: confirmPin,
                onChange: (e) =>
                  setConfirmPin((e.target as HTMLInputElement).value),
                placeholder: "Confirm PIN",
                className:
                  "bg-[#0B1220] border-[#1E2A40] text-[#E6EDF5] placeholder:text-[#8B98AC] focus-visible:ring-[#00D9C0]",
              }),
              error
                ? React.createElement(
                    "p",
                    { className: "text-sm text-[#E24B4A]" },
                    error,
                  )
                : null,
              React.createElement(
                Button,
                {
                  onClick: handlePinSubmit,
                  disabled: loading || !newPin || !confirmPin,
                  className:
                    "w-full bg-[#00D9C0] text-[#04342C] hover:bg-[#00D9C0]/90",
                },
                loading
                  ? React.createElement(Loader2, {
                      className: "h-4 w-4 animate-spin",
                    })
                  : null,
                loading ? "Restoring..." : "Finish recovery",
              ),
              React.createElement(
                Button,
                {
                  variant: "ghost",
                  onClick: () => {
                    setStep(1);
                    setError("");
                  },
                  className:
                    "w-full text-[#8B98AC] hover:text-[#E6EDF5] hover:bg-transparent",
                },
                React.createElement(ArrowLeft, { className: "h-4 w-4" }),
                "Back",
              ),
            ),
      ),
    ),
  );
}
