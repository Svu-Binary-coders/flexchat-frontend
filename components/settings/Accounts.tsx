/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useMutation } from "@tanstack/react-query";
import axiosInstance from "@/lib/axios";
import { toast } from "sonner";
import {
  Lock,
  ShieldCheck,
  Loader2,
  Eye,
  EyeOff,
  Mail,
  Timer,
  RotateCcw,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

async function changePassword(data: { oldPassword: string; password: string }) {
  if (data.oldPassword === data.password) {
    throw new Error("New password cannot be the same as current password");
  }
  const res = await axiosInstance.patch("/auth/change-password", data);
  return res.data;
}

async function sendEmailOTP(email: string) {
  const res = await axiosInstance.post("/otp/send-change-email-otp", { email });
  return res.data;
}

async function verifyEmailOTP(data: { email: string; otp: string }) {
  const res = await axiosInstance.patch("/otp/verify-change-email-otp", data);
  return res.data;
}

async function deleteAccount(password: string) {
  const res = await axiosInstance.delete("/auth/account", {
    data: { password },
  });
  return res.data;
}

//  Sub-components

function PasswordInput({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        {label}
      </label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pr-10 h-10 border-slate-200 focus-visible:ring-sky-400"
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: "8+ chars", pass: password.length >= 8 },
    { label: "Uppercase", pass: /[A-Z]/.test(password) },
    { label: "Number", pass: /[0-9]/.test(password) },
    { label: "Symbol", pass: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter((c) => c.pass).length;
  const color =
    score <= 1
      ? "bg-rose-400"
      : score === 2
        ? "bg-amber-400"
        : score === 3
          ? "bg-sky-400"
          : "bg-emerald-400";
  const label =
    score <= 1
      ? "Weak"
      : score === 2
        ? "Fair"
        : score === 3
          ? "Good"
          : "Strong";

  if (!password) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 w-8 rounded-full transition-all",
                i <= score ? color : "bg-slate-100",
              )}
            />
          ))}
        </div>
        <span
          className={cn(
            "text-[10px] font-bold",
            score <= 1
              ? "text-rose-400"
              : score === 2
                ? "text-amber-400"
                : score === 3
                  ? "text-sky-400"
                  : "text-emerald-500",
          )}
        >
          {label}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {checks.map((c) => (
          <span
            key={c.label}
            className={cn(
              "text-[9px] font-bold px-2 py-0.5 rounded-full",
              c.pass
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-100 text-slate-400",
            )}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function EmailUpdateModal({ currentEmail }: { currentEmail: string }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [timeLeft, setTimeLeft] = useState(300);
  const mydetalis = useAuthStore((state) => state.myDetails);
  const MyDetails = mydetalis;

  useEffect(() => {
    if (step !== 2) return;
    const t = setInterval(() => setTimeLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(t);
  }, [step]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const otpMutation = useMutation({
    mutationFn: () => {
      if (
        email.trim().toLowerCase() ===
        MyDetails?.email?.trim().toLowerCase()
      ) {
        return Promise.reject(
          new Error("New email cannot be the same as current email"),
        );
      }
      return sendEmailOTP(email);
    },
    onSuccess: () => {
      setStep(2);
      setTimeLeft(300);
    },
    onError: (error: any) => {
      toast.error(
        error?.message === "New email cannot be the same as current email"
          ? error.message
          : error?.response?.data?.message || "Failed to send OTP",
      );
    },
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyEmailOTP({ email, otp }),
    onSuccess: () => {
      toast.success("Email updated!");
      setOpen(false);
    },
    onError: (error: any) => {
      if (error.message === "New email cannot be the same as current email") {
        toast.error(error.message);
      } else {
        toast.error(error?.response?.data?.message || "Failed to send OTP");
      }
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="text-sky-600 border-sky-200 hover:bg-sky-50 text-xs h-8"
        >
          Change
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-sky-500" /> Update Email
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "Enter your new email address."
              : `Enter the 6-digit code sent to ${email}`}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4 pt-2">
            <Input
              type="email"
              placeholder="new@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && email && otpMutation.mutate()
              }
              className="h-10"
            />
            <Button
              onClick={() => otpMutation.mutate()}
              disabled={!email || otpMutation.isPending}
              className="w-full bg-sky-600 hover:bg-sky-700"
            >
              {otpMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Send Verification Code
            </Button>
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            <Input
              type="text"
              inputMode="numeric"
              placeholder="000000"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              className="text-center text-2xl tracking-[0.5em] font-mono h-14"
            />

            <div className="flex items-center justify-between">
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs font-medium",
                  timeLeft < 60 ? "text-rose-500" : "text-slate-400",
                )}
              >
                <Timer className="h-3.5 w-3.5" /> {fmt(timeLeft)}
              </div>
              {timeLeft === 0 && (
                <button
                  onClick={() => {
                    otpMutation.mutate();
                  }}
                  className="flex items-center gap-1 text-xs text-sky-500 hover:text-sky-600 font-medium"
                >
                  <RotateCcw className="h-3 w-3" /> Resend
                </button>
              )}
            </div>

            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={otp.length !== 6 || verifyMutation.isPending}
              className="w-full bg-emerald-600 hover:bg-emerald-700"
            >
              {verifyMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Verify & Update Email
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

//  Main

export default function Accounts() {
  const mydetalis = useAuthStore((state) => state.myDetails);
  const MyDetails = mydetalis;
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [deletePw, setDeletePw] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      toast.success("Password changed successfully");
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
    },
    onError: (err: any) => {
      if (
        err.message === "New password cannot be the same as current password"
      ) {
        toast.error(err.message);
      } else {
        toast.error(
          err?.response?.data?.message || "Incorrect current password",
        );
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccount,
    onSuccess: () => {
      toast.success("Account deleted");
      window.location.href = "/login";
    },
    onError: () => toast.error("Incorrect password"),
  });

  const canChangePassword =
    currentPw && newPw.length >= 8 && newPw === confirmPw;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/*  Email  */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <Mail className="h-4 w-4 text-sky-500" />
          <h2 className="text-sm font-bold text-slate-800">Email Address</h2>
        </div>
        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div>
            <p className="text-sm font-medium text-slate-700">
              {MyDetails?.email || "Not set"}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Your login email
            </p>
          </div>
          <EmailUpdateModal currentEmail={MyDetails?.email || ""} />
        </div>
      </div>

      {/*  Password  */}
      <div className="bg-white rounded-2xl border border-slate-100 p-6 space-y-5">
        <div className="flex items-center gap-2 pb-1">
          <Lock className="h-4 w-4 text-emerald-500" />
          <h2 className="text-sm font-bold text-slate-800">Change Password</h2>
        </div>

        <PasswordInput
          label="Current Password"
          placeholder="Enter current password"
          value={currentPw}
          onChange={setCurrentPw}
        />

        <div className="space-y-3">
          <PasswordInput
            label="New Password"
            placeholder="Min 8 characters"
            value={newPw}
            onChange={setNewPw}
          />
          <PasswordStrength password={newPw} />
        </div>

        <PasswordInput
          label="Confirm New Password"
          placeholder="Re-enter new password"
          value={confirmPw}
          onChange={setConfirmPw}
        />

        {newPw && confirmPw && newPw !== confirmPw && (
          <p className="text-xs text-rose-500 flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Passwords don&#39;t match
          </p>
        )}

        <Button
          onClick={() =>
            passwordMutation.mutate({
              oldPassword: currentPw,
              password: newPw,
            })
          }
          disabled={!canChangePassword || passwordMutation.isPending}
          className="w-full h-10 bg-slate-900 hover:bg-slate-800 text-white disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed"
        >
          {passwordMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <ShieldCheck className="h-4 w-4 mr-2" />
          )}
          Update Password
        </Button>
      </div>

      {/*  Danger zone  */}
      <div className="bg-white rounded-2xl border border-rose-100 p-6 space-y-4">
        <div className="flex items-center gap-2 pb-1">
          <AlertTriangle className="h-4 w-4 text-rose-500" />
          <h2 className="text-sm font-bold text-rose-600">Danger Zone</h2>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/50 border border-rose-100">
          <div>
            <p className="text-sm font-semibold text-slate-700">
              Delete Account
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              Permanently delete your account and all data
            </p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-500 border-rose-200 hover:bg-rose-50 text-xs h-8"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[380px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-rose-600">
                  <Trash2 className="h-4 w-4" /> Delete Account
                </DialogTitle>
                <DialogDescription>
                  This action is permanent and cannot be undone. Enter your
                  password to confirm.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <PasswordInput
                  label="Confirm Password"
                  placeholder="Enter your password"
                  value={deletePw}
                  onChange={setDeletePw}
                />
                <Button
                  onClick={() => deleteMutation.mutate(deletePw)}
                  disabled={!deletePw || deleteMutation.isPending}
                  className="w-full bg-rose-600 hover:bg-rose-700"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Permanently Delete Account
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}
