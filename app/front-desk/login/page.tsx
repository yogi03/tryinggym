"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, Check, X } from "lucide-react";
import { sendOTP, verifyOTP, resetPassword } from "./actions";

// Maps raw Firebase error codes → friendly messages
function getFriendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code || "";
  if (code === "auth/user-not-found") return "No Front Desk account found with this email address.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "Incorrect password. Please try again.";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/too-many-requests") return "Too many failed attempts. Please try again later.";
  if (code === "auth/user-disabled") return "This account has been disabled. Contact your gym owner.";
  return e?.message?.includes("not registered as Front Desk")
    ? "This account is not registered as Front Desk staff."
    : "Login failed. Please check your credentials and try again.";
}

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </li>
  );
}

// ─── Countdown timer hook ──────────
function useCountdown(initialSeconds: number) {
  const [seconds, setSeconds] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const start = () => {
    setSeconds(initialSeconds);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  return { seconds, start, expired: seconds === 0 };
}

type View = "login" | "forgot-email" | "forgot-otp" | "forgot-reset" | "success";

export default function FrontDeskLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<View>("login");

  // Forgot password state
  const [fpEmail, setFpEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const otpRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
  ];

  const countdown = useCountdown(60);
  const { loginAsFrontDesk } = useAuth();
  const router = useRouter();

  // Password rules logic
  const rules = {
    length: newPassword.length >= 6,
    upper: /[A-Z]/.test(newPassword),
    lower: /[a-z]/.test(newPassword),
    number: /[0-9]/.test(newPassword),
    special: /[^A-Za-z0-9]/.test(newPassword),
  };
  const allRulesMet = Object.values(rules).every(Boolean);
  const passwordsMatch = newPassword && newPassword === confirmPassword;

  // ── Login ──────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await loginAsFrontDesk(email, password);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send OTP ──────────
  const handleSendOTP = async () => {
    setIsLoading(true);
    setError(null);

    const result = await sendOTP(fpEmail);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Failed to send OTP.");
      return;
    }

    countdown.start();
    setOtp(["", "", "", ""]);
    setView("forgot-otp");
  };

  // ── Resend OTP ──────────
  const handleResend = async () => {
    setError(null);
    setIsLoading(true);
    const result = await sendOTP(fpEmail);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Failed to resend OTP.");
      return;
    }

    countdown.start();
    setOtp(["", "", "", ""]);
    otpRefs[0].current?.focus();
  };

  // ── Verify OTP ──────────
  const handleVerifyOTP = async () => {
    const code = otp.join("");
    if (code.length < 4) {
      setError("Please enter all 4 digits.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await verifyOTP(fpEmail, code);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Invalid OTP.");
      return;
    }

    setView("forgot-reset");
  };

  // ── Reset Password ──────────
  const handleResetPassword = async () => {
    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await resetPassword(fpEmail, newPassword);
    setIsLoading(false);

    if (!result.success) {
      setError(result.error || "Failed to reset password.");
      return;
    }

    setView("success");
  };

  // ── OTP digit input handler ──────────
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...otp];
    next[index] = value;
    setOtp(next);
    if (value && index < 3) otpRefs[index + 1].current?.focus();
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
    }
  };

  const ErrorBanner = ({ msg }: { msg: string }) => (
    <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      {msg}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="max-w-md w-full">

        {/* ── LOGIN ── */}
        {view === "login" && (
          <>
            <CardHeader className="text-center">
              <div className="flex justify-center mb-6">
                <Link href="/" className="transition-transform hover:scale-105 duration-300">
                  <Image src="/logo.png" alt="GymManagr Logo" width={180} height={45} className="h-12 w-auto object-contain" priority />
                </Link>
              </div>
              <CardTitle className="text-2xl font-bold">Front Desk Login</CardTitle>
              <CardDescription>Sign in to manage members, inquiries, and daily operations.</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin} autoComplete="off">
              <CardContent className="space-y-4">
                {error && <ErrorBanner msg={error} />}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="frontdesk@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 font-normal h-auto text-xs"
                      onClick={() => {
                        setFpEmail(email);
                        setError(null);
                        setView("forgot-email");
                      }}
                    >
                      Forgot Password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full bg-[#B6916D] hover:bg-[#B6916D]/90 text-white" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Login
                </Button>
                <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/admin/login")}>
                  Go To Admin Login
                </Button>
              </CardFooter>
            </form>
          </>
        )}

        {/* ── FORGOT — Step 1: Enter email ── */}
        {view === "forgot-email" && (
          <>
            <CardHeader>
              <Button variant="ghost" className="w-fit -ml-2 mb-2 h-8" onClick={() => { setView("login"); setError(null); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <CardTitle className="text-xl">Forgot Password</CardTitle>
              <CardDescription>Enter your front desk email to receive a 4-digit OTP.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <ErrorBanner msg={error} />}
              <div className="space-y-2">
                <Label htmlFor="fp-email">Email Address</Label>
                <Input
                  id="fp-email"
                  type="email"
                  placeholder="frontdesk@example.com"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" onClick={handleSendOTP} disabled={isLoading || !fpEmail}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
            </CardFooter>
          </>
        )}

        {/* ── FORGOT — Step 2: Enter OTP ── */}
        {view === "forgot-otp" && (
          <>
            <CardHeader>
              <Button variant="ghost" className="w-fit -ml-2 mb-2 h-8" onClick={() => { setView("forgot-email"); setError(null); }}>
                <ArrowLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <CardTitle className="text-xl">Enter OTP</CardTitle>
              <CardDescription>
                A 4-digit code was sent to <strong>{fpEmail}</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {error && <ErrorBanner msg={error} />}
              <div className="flex justify-center gap-2 sm:gap-4">
                {otp.map((digit, i) => (
                  <input
                    key={i}
                    ref={otpRefs[i]}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-12 h-12 sm:w-14 sm:h-14 text-center text-xl sm:text-2xl font-bold border-2 rounded-lg bg-background focus:outline-none focus:border-primary transition-colors text-white"
                  />
                ))}
              </div>
              <div className="text-center text-sm">
                {countdown.expired ? (
                  <span className="text-destructive">OTP expired.</span>
                ) : (
                  <span className="text-muted-foreground">
                    Expires in{" "}
                    <span className="font-semibold text-foreground tabular-nums">
                      {String(countdown.seconds).padStart(2, "0")}s
                    </span>
                  </span>
                )}
              </div>
              {countdown.expired && (
                <Button variant="outline" className="w-full" onClick={handleResend} disabled={isLoading}>
                  {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Resend OTP
                </Button>
              )}
            </CardContent>
            <CardFooter>
              <Button
                className="w-full"
                onClick={handleVerifyOTP}
                disabled={isLoading || countdown.expired || otp.join("").length < 4}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify OTP
              </Button>
            </CardFooter>
          </>
        )}

        {/* ── FORGOT — Step 3: New Password ── */}
        {view === "forgot-reset" && (
          <>
            <CardHeader>
              <CardTitle className="text-xl">Set New Password</CardTitle>
              <CardDescription>OTP verified! Enter your new password.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {error && <ErrorBanner msg={error} />}
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {newPassword.length > 0 && (
                <ul className="mt-2 space-y-1 bg-muted/50 rounded-md px-3 py-2 border border-border/50">
                  <PasswordRule met={rules.length} text="At least 6 characters" />
                  <PasswordRule met={rules.upper} text="At least 1 uppercase letter (A–Z)" />
                  <PasswordRule met={rules.lower} text="At least 1 lowercase letter (a–z)" />
                  <PasswordRule met={rules.number} text="At least 1 number (0–9)" />
                  <PasswordRule met={rules.special} text="At least 1 special character (!@#$%...)" />
                </ul>
              )}

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                />
                {confirmPassword && !passwordsMatch && (
                  <p className="text-[10px] text-destructive">Passwords do not match.</p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full bg-[#B6916D] hover:bg-[#B6916D]/90 text-white" onClick={handleResetPassword} disabled={isLoading || !allRulesMet || !passwordsMatch}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reset Password
              </Button>
            </CardFooter>
          </>
        )}

        {/* ── SUCCESS ── */}
        {view === "success" && (
          <CardContent className="py-12 text-center space-y-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold">Password Reset!</h2>
            <p className="text-muted-foreground">Your password has been updated successfully.</p>
            <Button
              className="w-full mt-4"
              onClick={() => {
                setView("login");
                setNewPassword("");
                setConfirmPassword("");
                setOtp(["", "", "", ""]);
                setFpEmail("");
                setError(null);
              }}
            >
              Back to Login
            </Button>
          </CardContent>
        )}

      </Card>
    </div>
  );
}
