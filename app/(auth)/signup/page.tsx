"use client";
import { useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  ShieldCheck,
  User,
  KeyRound,
  Copy,
  Check,
  AtSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { isAxiosError } from "axios";
import { toast } from "sonner";
import { useFingerprint } from "@/lib/useFingerprint";
import { KeyManager } from "@/core/e2e/KeyManager";
import { BackupManager } from "@/core/backup/Backupmanager";

// Modal step tracker
type ModalStep = "otp" | "recovery";

// userId: must start with a letter, 3-30 chars, lowercase/number/underscore only,
// and must contain at least one number or underscore
const USER_ID_REGEX = /^(?=.*[0-9_])[a-z][a-z0-9_]{2,29}$/;

// password: 8+ chars, 1 uppercase, 1 number, 1 special char
const PASSWORD_REGEX =
  /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>_\-]).{8,}$/;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RESEND_COOLDOWN_SECONDS = 30;

export default function SignupPage() {
  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");

  //  Email verification state — independent of registration
  const [emailVerified, setEmailVerified] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  //  User ID State
  const [userId, setUserId] = useState("");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [userIdMessage, setUserIdMessage] = useState(""); // server message (availability)

  // UI toggles
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false); // final "Create Account" submit
  const [copied, setCopied] = useState(false);

  // Modal state
  const [modalStep, setModalStep] = useState<ModalStep>("otp");
  const [showModal, setShowModal] = useState(false);
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState("");
  const [phraseConfirmed, setPhraseConfirmed] = useState(false);

  //  Resend OTP state — separate from sendingOtp/verifying
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const router = useRouter();
  const fingerprint = useFingerprint();

  //  Any edit to the email field invalidates a previous verification —
  // otherwise someone could verify email A then swap in email B and still pass as "verified"
  useEffect(() => {
    setEmailVerified(false);
  }, [email]);

  const isValidEmail = EMAIL_REGEX.test(email.trim());

  //  Instant userId format validation — no debounce, no API call
  const isValidFormat = USER_ID_REGEX.test(userId);
  const formatMessage = !userId.trim()
    ? ""
    : isValidFormat
      ? ""
      : userId.length < 3
        ? "User ID must be at least 3 characters"
        : !/[0-9_]/.test(userId)
          ? "User ID must contain at least one number or underscore"
          : "Only lowercase letters, numbers, and underscores allowed (must start with a letter)";

  //  Instant password format validation — no debounce, no API call
  const isValidPassword = PASSWORD_REGEX.test(password);
  const passwordMessage = !password
    ? ""
    : isValidPassword
      ? ""
      : password.length < 8
        ? "Password must be at least 8 characters"
        : !/[A-Z]/.test(password)
          ? "Password must contain at least one uppercase letter"
          : !/[0-9]/.test(password)
            ? "Password must contain at least one number"
            : !/[!@#$%^&*(),.?":{}|<>_\-]/.test(password)
              ? "Password must contain at least one special character"
              : "";

  //  User ID Availability Check Effect — only the API call is debounced,
  // and only fires once the format is already valid
  useEffect(() => {
    const checkUserIdAvailability = async (id: string) => {
      setIsChecking(true);
      try {
        const response = await api.get(
          `/auth/check-userId?userId=${encodeURIComponent(id)}`,
        );
        setIsAvailable(response.data.available);
        setUserIdMessage(response.data.message || "");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        console.error("Error checking User ID availability:", error);
        setIsAvailable(false);
        if (
          error &&
          error.response &&
          error.response.data &&
          error.response.data.message
        ) {
          setUserIdMessage(error.response.data.message);
        } else if (error && error.message) {
          const cleanMessage = String(error.message).replace("Error: ", "");
          setUserIdMessage(cleanMessage);
        } else {
          setUserIdMessage("Something went wrong!");
        }
      } finally {
        setIsChecking(false);
      }
    };

    if (!userId.trim() || !isValidFormat) {
      setIsAvailable(null);
      setUserIdMessage("");
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      checkUserIdAvailability(userId);
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [userId, isValidFormat]);

  //  Resend cooldown ticker
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  //  Triggered by the "Send OTP" button beside the email field — only sends the OTP,
  // does not touch name/userId/password/pin at all
  const handleSendOtp = async () => {
    if (!email.trim()) {
      toast.error("Please enter your email first");
      return;
    }
    if (!isValidEmail) {
      toast.error("Please enter a valid email address");
      return;
    }

    setSendingOtp(true);
    try {
      const { data } = await api.post("/otp/send-register-otp", { email });
      if (data.success) {
        toast.success("OTP sent to " + email);
        setModalStep("otp");
        setShowModal(true);
        setOtp("");
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.error(data.message || "OTP sending fail");
      }
    } catch (e) {
      if (isAxiosError(e)) {
        toast.error(e.response?.data?.message || "OTP sending fail");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setSendingOtp(false);
    }
  };

  //  Resend OTP — separate loading/cooldown state
  const handleResendOtp = async () => {
    if (resendCooldown > 0 || resending) return;

    setResending(true);
    try {
      const { data } = await api.post("/otp/send-register-otp", { email });
      if (data.success) {
        toast.success("New OTP sent to " + email);
        setOtp("");
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
      } else {
        toast.error(data.message || "Failed to resend OTP");
      }
    } catch (e) {
      if (isAxiosError(e)) {
        toast.error(e.response?.data?.message || "Failed to resend OTP");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setResending(false);
    }
  };

  //  Close modal + fully reset OTP-related state so reopening never shows stale data
  const handleCloseModal = () => {
    setShowModal(false);
    setModalStep("otp");
    setOtp("");
    setResendCooldown(0);
    setResending(false);
  };

  //  Only verifies the OTP and marks email as verified — does NOT register the account
  const handleVerifyOtp = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the OTP");
      return;
    }
    setVerifying(true);

    try {
      const verifyRes = await api.post("/otp/verify-register-otp", {
        email,
        otp,
      });

      if (!verifyRes.data.success) {
        toast.error(verifyRes.data.message || "Invalid OTP");
        setOtp(""); // wrong/expired OTP — clear it, don't leave stale value in the field
        setVerifying(false);
        return;
      }

      setEmailVerified(true);
      toast.success("Email verified!");
      setShowModal(false);
      setOtp("");
      setResendCooldown(0);
    } catch (e) {
      console.error("[OTP Verify Error]:", e);
      if (isAxiosError(e)) {
        toast.error(e.response?.data?.message || "Verification failed");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setVerifying(false);
    }
  };

  //  Final submit — only runs after email is already verified. Does registration + E2E setup.
  const handleRegister = async () => {
    if (
      !name.trim() ||
      !email.trim() ||
      !password.trim() ||
      !pin.trim() ||
      !userId.trim()
    ) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!emailVerified) {
      toast.error("Please verify your email first");
      return;
    }

    if (!isValidFormat) {
      toast.error(formatMessage || "Please enter a valid User ID");
      return;
    }

    if (!isValidPassword) {
      toast.error(passwordMessage || "Please enter a valid password");
      return;
    }

    if (isAvailable === false) {
      toast.error("Please choose an available User ID");
      return;
    }

    setLoading(true);
    try {
      const registerRes = await api.post("/auth/register", {
        name,
        email,
        password,
        userId,
        fingerprintId: fingerprint,
        rememberMe,
      });

      if (!registerRes.data.success) {
        toast.error(registerRes.data.message || "Registration fail");
        setLoading(false);
        return;
      }

      const registeredUserId =
        registerRes.data.userId || registerRes.data.userDetails?._id;

      if (!registeredUserId) {
        toast.error("User ID not returned from server");
        setLoading(false);
        return;
      }

      // E2E Setup
      const identity = await KeyManager.createAndStoreIdentity(
        registeredUserId,
        pin,
      );

      // save current keys to active session for auto-login
      const { privateKey, signingKey } = await KeyManager.loadIdentity(
        registeredUserId,
        pin,
      );
      await KeyManager.saveActiveKeys(registeredUserId, privateKey, signingKey);

      const masterKey = await KeyManager.deriveMasterKey(pin, identity.saltB64);

      const { recoveryPhrase: phrase, encBackupKey } =
        await BackupManager.createBackupKey(masterKey);

      const backupKey = await api.post("/backup/create", {
        userId: registeredUserId,
        publicKey64: identity.publicKeyB64,
        saltB64: identity.saltB64,
        encBackupKey: {
          ctBase64: encBackupKey.ctB64,
          ivBase64: encBackupKey.ivB64,
        },
        identityBackup: {
          encPrivKeyB64: identity.encPrivKeyB64,
          privKeyIvB64: identity.privKeyIvB64,
          sigKeyB64: identity.sigKeyB64,
          sigKeyIvB64: identity.sigKeyIvB64,
        },
      });
      if (!backupKey.data.success) {
        toast.error(backupKey.data.message || "Failed to create backup key");
        setLoading(false);
        return;
      }

      setRecoveryPhrase(phrase);
      setModalStep("recovery");
      setShowModal(true); // reopen modal now, for the recovery-phrase step
    } catch (e) {
      console.error("[Signup Error]:", e);
      if (isAxiosError(e)) {
        toast.error(e.response?.data?.message || "Registration fail");
      } else {
        toast.error((e as Error).message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyPhrase = async () => {
    await navigator.clipboard.writeText(recoveryPhrase);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFinish = () => {
    if (!phraseConfirmed) {
      toast.error("Please confirm that you have saved your recovery phrase");
      return;
    }
    toast.success("Registration successful!");
    router.push("/chat?page=chats");
  };

  // UI
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

      {/* Signup Card */}
      <div className="w-full max-w-[420px] bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
        <div className="text-center mb-7">
          <h1 className="text-2xl font-bold text-slate-800 mb-1.5">
            Create an account
          </h1>
          <p className="text-sm text-slate-400 leading-relaxed">
            Setup your secure workspace and encryption keys
          </p>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Full Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                className="pl-9 h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:border-sky-400 placeholder:text-slate-300"
              />
            </div>
          </div>

          {/* User ID (Unique) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              User ID (Unique)
            </label>
            <div className="relative">
              <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                value={userId}
                onChange={(e) =>
                  setUserId(e.target.value.toLowerCase().replace(/\s/g, ""))
                }
                placeholder="e.g. johndoe123"
                className="pl-9 h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:border-sky-400 placeholder:text-slate-300"
              />
            </div>
            {/* Instant format error takes priority; otherwise show server availability status */}
            {userId && (
              <div className="text-xs pt-1 pl-1">
                {formatMessage ? (
                  <span className="text-red-500 font-medium">
                    {formatMessage}
                  </span>
                ) : isChecking ? (
                  <span className="text-slate-500">
                    Checking availability...
                  </span>
                ) : isAvailable === true ? (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" />{" "}
                    {userIdMessage || "User ID is available"}
                  </span>
                ) : isAvailable === false ? (
                  <span className="text-red-500 font-medium">
                    {userIdMessage || "This User ID is not available"}
                  </span>
                ) : null}
              </div>
            )}
          </div>

          {/* Email — with inline Send OTP / Verified button */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Email Address
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  disabled={emailVerified}
                  className="pl-9 h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:border-sky-400 placeholder:text-slate-300 disabled:opacity-70 disabled:bg-slate-50"
                />
              </div>
              <Button
                type="button"
                onClick={handleSendOtp}
                disabled={
                  !email.trim() || !isValidEmail || emailVerified || sendingOtp
                }
                className={`h-11 shrink-0 rounded-xl px-4 text-sm font-semibold transition-all disabled:opacity-60 ${
                  emailVerified
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-50"
                    : "bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-100"
                }`}
              >
                {emailVerified ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-4 w-4" /> Verified
                  </span>
                ) : sendingOtp ? (
                  "Sending..."
                ) : (
                  "Send OTP"
                )}
              </Button>
            </div>
            {email && !isValidEmail && (
              <p className="text-xs text-red-500 font-medium pt-1 pl-1">
                Please enter a valid email address
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {/* Instant password format feedback */}
            {password && (
              <div className="text-xs pt-1 pl-1">
                {passwordMessage ? (
                  <span className="text-red-500 font-medium">
                    {passwordMessage}
                  </span>
                ) : (
                  <span className="text-emerald-500 font-medium flex items-center gap-1">
                    <Check className="h-3 w-3" /> Strong password
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Chat PIN */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-700">
              Secure Chat PIN
            </label>
            <p className="text-xs text-slate-400">
              6-digit PIN for encrypting your messages. Keep it secret!
            </p>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type={showPin ? "text" : "password"}
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. 123456"
                className="pl-9 pr-10 h-11 rounded-xl border-slate-200 text-sm focus-visible:ring-1 focus-visible:ring-sky-400 focus-visible:border-sky-400 placeholder:text-slate-300"
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
          </div>

          {/* Remember me */}
          <div className="flex items-center gap-2.5 pt-2">
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

          <Button
            onClick={handleRegister}
            disabled={
              !email.trim() ||
              !password.trim() ||
              !name.trim() ||
              !userId.trim() ||
              !pin.trim() ||
              !emailVerified ||
              !isValidFormat ||
              !isValidPassword ||
              isChecking ||
              isAvailable === false ||
              loading
            }
            className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold text-sm transition-all shadow-md shadow-sky-100 hover:shadow-sky-200 disabled:opacity-50 mt-3"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </Button>
          {!emailVerified && (
            <p className="text-xs text-slate-400 text-center pt-1">
              Verify your email above to enable sign up
            </p>
          )}
        </div>
      </div>

      <p className="text-sm text-slate-500 mt-6">
        Already have an account?{" "}
        <Link
          href="/login"
          className="text-sky-500 font-semibold hover:text-sky-600 transition-colors"
        >
          Log in
        </Link>
      </p>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-[420px] p-6 shadow-xl">
            {/* OTP Step — verification only, does not register */}
            {modalStep === "otp" && (
              <>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
                  Please verify your email
                </h3>
                <p className="text-sm text-slate-500 text-center mb-6">
                  Enter the OTP sent to{" "}
                  <span className="font-semibold text-slate-700">{email}</span>.
                </p>
                <p className="text-sm text-slate-500 text-center mb-6">
                  OTP is valid for 5 minutes.
                </p>
                <div className="space-y-4">
                  <Input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="Enter OTP"
                    className="text-center tracking-widest text-lg h-12 rounded-xl border-slate-200 focus-visible:ring-1 focus-visible:ring-sky-400"
                  />

                  {/*  Resend OTP row */}
                  <div className="flex items-center justify-center text-xs">
                    {resendCooldown > 0 ? (
                      <span className="text-slate-400">
                        Resend OTP in {resendCooldown}s
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={resending}
                        className="text-sky-600 font-semibold hover:text-sky-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {resending ? "Resending..." : "Resend OTP"}
                      </button>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleCloseModal}
                      className="flex-1 rounded-xl border-slate-200 text-slate-600"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleVerifyOtp}
                      disabled={!otp.trim() || verifying}
                      className="flex-1 rounded-xl bg-sky-500 hover:bg-sky-600 text-white shadow-md shadow-sky-100"
                    >
                      {verifying ? "Verifying..." : "Verify Email"}
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Recovery Phrase Step — shown after handleRegister succeeds */}
            {modalStep === "recovery" && (
              <>
                <div className="flex items-center justify-center mb-4">
                  <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center">
                    <ShieldCheck className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-slate-800 text-center mb-2">
                  Save Your Recovery Phrase
                </h3>
                <p className="text-sm text-slate-500 text-center mb-5">
                  Please save your recovery phrase in a secure location.
                  <span className="text-red-500 font-semibold">
                    {" "}
                    This is the only way to recover your account if you forget
                    your PIN or lose access to your device.
                  </span>
                </p>

                {/* Phrase grid */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {recoveryPhrase.split(" ").map((word, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5"
                    >
                      <span className="text-[10px] text-slate-400 w-4 shrink-0">
                        {i + 1}.
                      </span>
                      <span className="text-xs font-mono font-medium text-slate-700">
                        {word}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Copy button */}
                <button
                  onClick={handleCopyPhrase}
                  className="w-full flex items-center justify-center gap-2 text-sm text-sky-600 border border-sky-200 rounded-xl py-2.5 mb-4 hover:bg-sky-50 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" /> Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copy phrase
                    </>
                  )}
                </button>

                {/* Confirm checkbox */}
                <div className="flex items-start gap-2.5 mb-5">
                  <Checkbox
                    id="confirm"
                    checked={phraseConfirmed}
                    onCheckedChange={(v) => setPhraseConfirmed(!!v)}
                    className="mt-0.5 rounded border-slate-300 data-[state=checked]:bg-sky-500 data-[state=checked]:border-sky-500"
                  />
                  <label
                    htmlFor="confirm"
                    className="text-sm text-slate-600 cursor-pointer leading-relaxed"
                  >
                    I have saved my recovery phrase in a secure location and
                    understand that I will lose access to my account if I lose
                    this phrase.
                  </label>
                </div>

                <Button
                  onClick={handleFinish}
                  disabled={!phraseConfirmed}
                  className="w-full h-11 rounded-xl bg-sky-500 hover:bg-sky-600 text-white font-semibold disabled:opacity-50"
                >
                  Finish
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
