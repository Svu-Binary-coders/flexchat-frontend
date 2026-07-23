"use client";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { toast } from "sonner";
import { isAxiosError } from "axios";
import { useFingerprint } from "@/lib/useFingerprint";
import { KeyManager } from "@/core/e2e/KeyManager";
import { useSessionStore } from "@/stores/sessionStore";
import { BackupManager } from "@/core/backup/Backupmanager";

export default function LoginPage() {
  // Form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  // PIN modal state
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  // User data from server response
  const [loggedInUserId, setLoggedInUserId] = useState("");
  const [loggedInSalt, setLoggedInSalt] = useState("");
  const [loggedInPublicKey, setLoggedInPublicKey] = useState("");
  const [loggedInEncBackup, setLoggedInEncBackup] = useState<{
    ctB64: string;
    ivB64: string;
  } | null>(null);
  const [loggedInIdentityBackup, setLoggedInIdentityBackup] = useState<{
    encPrivKeyB64: string;
    privKeyIvB64: string;
    sigKeyB64: string;
    sigKeyIvB64: string;
  } | null>(null);

  const router = useRouter();
  const fingerprint = useFingerprint();
  const { setSession } = useSessionStore();

  // Step 1: Authenticate user and fetch encrypted keys from server
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) return;
    setLoading(true);

    try {
      const { data } = await api.post("/auth/login", {
        email,
        password,
        fingerprintId: fingerprint,
        rememberMe,
      });

      if (!data.success) {
        toast.error(data.message || "Login failed");
        return;
      }

      // Extract user data from server response
      const userId = data.userId || data.user?._id;
      const backupData = data.backupData;

      if (!userId || !backupData || !backupData.saltB64) {
        toast.error("Server security data is missing!");
        return;
      }

      // Store user data in state
      setLoggedInUserId(userId);
      setLoggedInSalt(backupData.saltB64);
      setLoggedInPublicKey(backupData.publicKey64);
      setLoggedInEncBackup(backupData.encBackupKey);
      setLoggedInIdentityBackup(backupData.identityBackup);

      // Show PIN modal for final unlock
      setShowPinModal(true);
    } catch (e) {
      if (isAxiosError(e)) {
        toast.error(e.response?.data?.message || "Login failed");
      } else {
        toast.error(e instanceof Error ? e.message : "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Unlock E2E keys with PIN and restore backup
  const handleUnlockWithPin = async () => {
    if (!pin.trim()) {
      toast.error("Please enter your PIN");
      return;
    }
    setUnlocking(true);

    try {
      let identityKeys;

      // Try loading identity from local IndexedDB
      try {
        identityKeys = await KeyManager.loadIdentity(loggedInUserId, pin);
      } catch (error) {
        // New device detected - restore identity from server backup
        console.log("New device detected - restoring identity from server");

        if (!loggedInIdentityBackup || !loggedInPublicKey) {
          throw new Error("Identity backup not found on server");
        }

        // Create identity object from server backup
        const serverIdentity = {
          userId: loggedInUserId,
          publicKeyB64: loggedInPublicKey,
          saltB64: loggedInSalt,
          encPrivKeyB64: loggedInIdentityBackup.encPrivKeyB64,
          privKeyIvB64: loggedInIdentityBackup.privKeyIvB64,
          sigKeyB64: loggedInIdentityBackup.sigKeyB64,
          sigKeyIvB64: loggedInIdentityBackup.sigKeyIvB64,
        };

        // Save to IndexedDB
        await KeyManager._idbSet(
          `fcp_identity_${loggedInUserId}`,
          serverIdentity,
        );

        // Load from local database
        identityKeys = await KeyManager.loadIdentity(loggedInUserId, pin);
      }

      const { privateKey, signingKey, identity } = identityKeys;
      await KeyManager.saveActiveKeys(loggedInUserId, privateKey, signingKey);

      // Derive master key from PIN
      const masterKey = await KeyManager.deriveMasterKey(
        pin,
        loggedInSalt || identity.saltB64,
      );

      // Restore backup key
      let backupKey: CryptoKey | null = null;

      if (loggedInEncBackup) {
        backupKey = await BackupManager.restoreBackupKey(
          masterKey,
          loggedInEncBackup,
        );
      }

      // Store session in Zustand
      setSession({
        userId: loggedInUserId,
        privateKey,
        signingKey,
        backupKey,
        needPin: false,
      });

      toast.success("Unlocked! Redirecting to chat...");
      router.push("/chat?page=chats");
    } catch (e) {
      console.error("[PIN Unlock Error]:", e);

      if (e instanceof DOMException || String(e).includes("unwrap")) {
        toast.error("Incorrect PIN. Please try again.");
      } else {
        toast.error(e instanceof Error ? e.message : "Unlock failed");
      }
    } finally {
      setUnlocking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      showPinModal ? handleUnlockWithPin() : handleLogin();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-8">
        <div className="h-9 w-9 rounded-xl bg-sky-500 flex items-center justify-center shadow-md shadow-sky-100">
          <ShieldCheck className="h-5 w-5 text-white" />
        </div>
        <span className="text-xl font-bold text-sky-500 tracking-tight">
          SecureChat
        </span>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold text-slate-800 mb-1.5">
            Welcome back
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Enter your credentials to access your secure workspace
          </p>
        </div>

        <div className="space-y-4">
          {/* Email Input */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Email or Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="name@company.com"
                className="pl-9 h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:border-sky-400 placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* Password Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm text-sky-500 hover:text-sky-600 font-medium transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="••••••••"
                className="pl-9 pr-10 h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:border-sky-400 placeholder:text-slate-300"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me Checkbox */}
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="stay"
              checked={rememberMe}
              onCheckedChange={(v) => setRememberMe(!!v)}
              className="rounded border-slate-300 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
            />
            <label
              htmlFor="stay"
              className="text-sm text-slate-600 cursor-pointer select-none"
            >
              Stay logged in for 30 days
            </label>
          </div>

          {/* Login Button */}
          <Button
            onClick={handleLogin}
            disabled={!email.trim() || !password.trim() || loading}
            className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all shadow-md shadow-sky-100 hover:shadow-sky-200 disabled:opacity-50 mt-1"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                Logging in...
              </span>
            ) : (
              "Log In"
            )}
          </Button>
        </div>

        {/* Terms and Privacy */}
        <p className="text-center text-xs text-slate-400 mt-5 leading-relaxed">
          By continue you agree our{" "}
          <Link href="/terms" className="text-slate-500 hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="text-slate-500 hover:underline">
            privacy policy
          </Link>
        </p>
      </div>

      {/* Sign Up Link */}
      <p className="text-sm text-slate-500 mt-6">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="text-sky-500 font-semibold hover:text-sky-600 transition-colors"
        >
          Sign up
        </Link>
      </p>

      {/* Security Badge */}
      <p className="text-xs text-slate-300 mt-8 flex items-center gap-1.5">
        <ShieldCheck className="h-3 w-3" />
        End-to-end encrypted — FCP v1
      </p>

      {/* PIN Modal Dialog */}
      {showPinModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-[380px] p-6 shadow-xl">
            {/* Icon */}
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 rounded-full bg-sky-100 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-sky-600" />
              </div>
            </div>

            {/* Title and Description */}
            <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
              Enter Chat PIN
            </h3>
            <p className="text-sm text-slate-500 text-center mb-6">
              A Chat PIN is required to unlock your encrypted messages. This is
              different from your login password.
            </p>

            <div className="space-y-4">
              {/* PIN Input */}
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type={showPin ? "text" : "password"}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Chat PIN"
                  className="pl-9 pr-10 text-center tracking-widest text-lg h-12 rounded-xl border-slate-200 focus-visible:ring-1 focus-visible:ring-sky-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPin ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPinModal(false);
                    setPin("");
                  }}
                  className="flex-1 rounded-xl border-slate-200 text-slate-600"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleUnlockWithPin}
                  disabled={!pin.trim() || unlocking}
                  className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-100"
                >
                  {unlocking ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Unlocking...
                    </span>
                  ) : (
                    "Unlock"
                  )}
                </Button>
              </div>

              {/* Recovery Link */}
              <p className="text-center text-xs text-slate-400 mt-2">
                Forgot your PIN?{" "}
                <Link
                  href="/recover"
                  className="text-sky-500 hover:text-sky-600 font-medium"
                >
                  Use recovery phrase to restore
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
