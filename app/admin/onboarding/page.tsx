"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Eye, EyeOff, Check, X } from "lucide-react";
import { registerGymAndOwner } from "./actions";

function PasswordRule({ met, text }: { met: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 text-xs ${met ? "text-green-600 dark:text-green-400" : "text-muted-foreground"}`}>
      {met ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {text}
    </li>
  );
}

export default function OnboardingPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  const rules = {
    length: password.length >= 6,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
  };
  const allRulesMet = Object.values(rules).every(Boolean);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);

    try {
      const result = await registerGymAndOwner(formData);

      if (result.success) {
        setIsSuccess(true);
      } else {
        setError(result.error || "An unknown error occurred");
      }
    } catch (err) {
      setError((err as Error).message || "Failed to register. Check your server logs.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <Card className="max-w-md w-full text-center py-8">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <CardTitle className="text-2xl">Setup Complete!</CardTitle>
            <CardDescription>
              Congratulations! Your gym has been registered. You can now log in as an admin.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push("/admin/login")}>Go to Admin Login</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <Link href="/" className="transition-transform hover:scale-105 duration-300">
              <Image src="/logo.png" alt="GymManagr Logo" width={180} height={45} className="h-12 w-auto object-contain" priority />
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold">Gym Onboarding</CardTitle>
          <CardDescription>
            Register your gym and the first administrator account.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Gym Details</h3>
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gymName">Gym Name *</Label>
                  <Input id="gymName" name="gymName" placeholder="e.g. Iron Paradise" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gymAddress">Gym Address *</Label>
                  <Input id="gymAddress" name="gymAddress" placeholder="Street, City, Zip" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gymPhone">Gym Mobile Number *</Label>
                  <Input id="gymPhone" name="gymPhone" placeholder="e.g. +91 99999 88888" required />
                </div>
                {/* <div className="space-y-2">
                  <Label htmlFor="gstNo">GST Number (Optional)</Label>
                  <Input id="gstNo" name="gstNo" placeholder="e.g. 07AAACA1234A1Z1" />
                </div> */}
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Owner / Admin Details</h3>
              <div className="space-y-2">
                <Label htmlFor="ownerEmail">Email Address *</Label>
                <Input id="ownerEmail" name="ownerEmail" type="email" placeholder="owner@example.com" required />
                <p className="text-[10px] text-muted-foreground">This email will have admin access.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Login Password *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Strong password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pr-10"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {/* Live password rules */}
                {password.length > 0 && (
                  <ul className="mt-2 space-y-1 bg-muted/50 rounded-md px-3 py-2">
                    <PasswordRule met={rules.length} text="At least 6 characters" />
                    <PasswordRule met={rules.upper} text="At least 1 uppercase letter (A–Z)" />
                    <PasswordRule met={rules.lower} text="At least 1 lowercase letter (a–z)" />
                    <PasswordRule met={rules.number} text="At least 1 number (0–9)" />
                    <PasswordRule met={rules.special} text="At least 1 special character (!@#$%...)" />
                  </ul>
                )}
                <p className="text-[10px] text-muted-foreground">You will use this password to log in.</p>
              </div>
            </div>

          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading || !allRulesMet}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Complete Registration
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
