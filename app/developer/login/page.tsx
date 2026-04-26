"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";

function getFriendlyError(err: unknown): string {
  const e = err as { code?: string; message?: string };
  const code = e?.code || "";
  if (code === "auth/user-not-found") return "No developer account found with this email address.";
  if (code === "auth/wrong-password" || code === "auth/invalid-credential") return "Incorrect password. Please try again.";
  if (code === "auth/invalid-email") return "Please enter a valid email address.";
  if (code === "auth/too-many-requests") return "Too many failed attempts. Please try again later.";
  if (code === "auth/user-disabled") return "This account has been disabled. Contact support.";
  return e?.message?.includes("not registered as a developer")
    ? "This account is not registered as a developer."
    : "Login failed. Please check your credentials and try again.";
}

export default function DeveloperLoginPage() {
  const router = useRouter();
  const { loginAsDeveloper } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await loginAsDeveloper(email, password);
      router.push("/admin/dashboard");
    } catch (err) {
      setError(getFriendlyError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-6">
            <Link href="/" className="transition-transform hover:scale-105 duration-300">
              <Image src="/logo.png" alt="Logo" width={180} height={45} className="h-12 w-auto object-contain" priority />
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold">Developer Login</CardTitle>
          <CardDescription>Sign in to inspect and manage any registered gym.</CardDescription>
        </CardHeader>

        <form onSubmit={handleLogin} autoComplete="off">
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-3 rounded-md flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="developer-email">Email</Label>
              <Input
                id="developer-email"
                type="email"
                placeholder="developer@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="developer-password">Password</Label>
              <div className="relative">
                <Input
                  id="developer-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
            <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/admin/login")}>
              Go To Admin Login
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
