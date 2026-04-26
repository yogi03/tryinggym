"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, Clock, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function PendingApprovalPage() {
  const { activeGym, user, logout, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return (
      <div className="flex bg-[#0F0F1A] h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0F0F1A] p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 rounded-full blur-[120px]" />

      <div className="max-w-2xl w-full z-10">
        <div className="flex justify-center mb-10">
          <Link href="/" className="transition-transform hover:scale-105 duration-300">
            <Image 
              src="/logo.png" 
              alt="GymManagr Logo" 
              width={220} 
              height={55} 
              className="h-14 w-auto object-contain drop-shadow-[0_0_15px_rgba(182,145,109,0.2)]" 
              priority 
            />
          </Link>
        </div>

        <Card className="border-white/[0.08] bg-[#1A1A2E]/80 backdrop-blur-sm text-white shadow-2xl overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-amber-600"></div>
          
          <CardHeader className="text-center pt-10">
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 rounded-full bg-amber-500/10 flex items-center justify-center border-2 border-amber-500/20">
                <Clock className="h-10 w-10 text-amber-500 animate-pulse" />
              </div>
            </div>
            <CardTitle className="text-3xl font-bold tracking-tight">Application Under Review</CardTitle>
            <CardDescription className="text-xl text-[#8888A0] mt-2">
              Welcome to the family! We're reviewing <strong>{activeGym?.name || "your gym"}</strong>.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6 px-10 pt-4 text-center">
            <div className="bg-white/[0.02] border border-white/[0.05] rounded-xl p-6 space-y-4">
              <p className="text-[#8888A0] leading-relaxed">
                Thank you for choosing GymManagr. To ensure the quality and security of our platform, all new gym registrations are manually reviewed by our system administrators.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center text-sm font-medium">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <ShieldCheck className="h-4 w-4 text-amber-500" />
                  <span>Verified Security Check</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <Mail className="h-4 w-4 text-amber-500" />
                  <span>Email Confirmation Sent</span>
                </div>
              </div>
            </div>

            <p className="text-sm text-[#8888A0]">
              This process typically takes less than 24 hours. You will receive an email notification as soon as your dashboard is ready.
            </p>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pb-10 px-10">
            <div className="h-px w-full bg-white/[0.08] mb-4"></div>
            <p className="text-xs text-[#8888A0] mb-4">Logged in as: <span className="text-white">{user?.email}</span></p>
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <Button 
                variant="outline" 
                className="flex-1 bg-transparent border-white/[0.1] hover:bg-white/[0.05] text-white"
                onClick={() => window.location.reload()}
              >
                Refresh Status
              </Button>
              <Button 
                variant="destructive" 
                className="flex-1"
                onClick={async () => {
                  await logout();
                  router.replace("/");
                }}
              >
                Log Out
              </Button>
            </div>
          </CardFooter>
        </Card>

        <p className="text-center mt-8 text-[#8888A0] text-sm">
          Need urgent help? Contact us at unfav.tushar@gmail.com
        </p>
      </div>
    </div>
  );
}
