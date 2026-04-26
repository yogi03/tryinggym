"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { doc, getDoc } from "firebase/firestore";
import { Gym } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const trialFormSchema = z.object({
  fullName: z.string().min(2, "Full Name is required"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Phone must be exactly 10 digits starting with 6, 7, 8, or 9"),
  email: z.string().email("Invalid email address"),
  gender: z.string().refine((val) => ["male", "female", "prefer-not-to-say"].includes(val), {
    message: "Please select a gender",
  }),
  trialDate: z.string().min(1, "Trial date is required"),
}).refine((data) => {
  const trialDate = new Date(data.trialDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return trialDate >= today;
}, {
  message: "Trial date cannot be in the past",
  path: ["trialDate"],
});

export default function TrialPage() {
  const [gymId, setGymId] = useState<string | null>(null);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { user, loginWithGoogle } = useAuth();
  const { toast } = useToast();
  const [gymData, setGymData] = useState<Gym | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      setGymId(params.get("gym"));
    }
  }, []);

  useEffect(() => {
    async function fetchGym() {
      if (!gymId) return;
      try {
        const docRef = doc(db, "gyms", gymId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setGymData({ gymId, ...docSnap.data() } as Gym);
        }
      } catch (err) {
        console.error("Error fetching gym branding:", err);
      }
    }
    fetchGym();
  }, [gymId]);

  const form = useForm<z.infer<typeof trialFormSchema>>({
    resolver: zodResolver(trialFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      gender: "",
      trialDate: new Date().toISOString().split("T")[0],
    },
  });

  useEffect(() => {
    if (user) {
      if (!form.getValues("email")) {
        form.setValue("email", user.email || "");
      }
      if (!form.getValues("fullName")) {
        form.setValue("fullName", user.displayName || "");
      }
    }
  }, [user, form]);

  async function onSubmit(values: z.infer<typeof trialFormSchema>) {
    if (!user) {
      toast({ title: "Authentication Required", description: "Please click 'Continue with Google' first.", variant: "destructive" });
      return;
    }

    if (!gymId) {
      toast({ title: "Error", description: "Invalid gym ID.", variant: "destructive" });
      return;
    }

    setIsLoading(true);
    const { dismiss } = toast({ title: "Registering...", description: "Processing your trial registration.", duration: Infinity });

    try {
      const { registerTrialMember } = await import("./actions");
      const result = await registerTrialMember(gymId, values);

      dismiss();

      if (!result.success) {
        if (result.field) {
          form.setError(result.field as any, { message: result.error });
        } else {
          toast({ title: "Error", description: result.error, variant: "destructive" });
        }
        setIsLoading(false);
        return;
      }

      toast({ title: "Success", description: "Your trial pass has been registered!" });
      setIsSuccess(true);
    } catch (error) {
      dismiss();
      console.error("Error submitting trial registration:", error);
      const errorMsg = error instanceof Error ? error.message : "Process failed. Please check your internet and try again.";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F1A] p-4">
        <Card className="max-w-md w-full text-center py-8 bg-[#1A1A2E]/80 border-white/[0.08]">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Image src={gymData?.logoUrl || "/gymmanagr-logo.png"} alt="Logo" width={180} height={45} className="h-12 w-auto object-contain" priority />
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#B6916D] to-[#B6916D]/60 bg-clip-text text-transparent">Trial Registered!</CardTitle>
            <CardDescription className="text-[#8888A0]">
              Your trial pass for {gymData?.name || "the gym"} has been confirmed. We look forward to seeing you!
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex justify-center">
            <Button onClick={() => router.push("/")} className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white">Go to Home</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-center mb-10 gap-2">
          <Image src={gymData?.logoUrl || "/gymmanagr-logo.png"} alt={gymData?.name || "GymManagr"} width={200} height={50} className="h-20 w-auto object-contain" priority />
        </div>

        <Card className="bg-[#1A1A2E]/80 border-white/[0.08] text-white backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold text-white">Trial Pass Registration</CardTitle>
            <CardDescription className="text-[#8888A0]">
              {gymData ? `Register for a 1-day trial at ${gymData.name}` : gymId ? `Loading gym details...` : "Please use a valid gym trial link."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!gymId ? (
              <div className="text-red-400 font-medium text-center py-8 bg-red-500/5 rounded-xl border border-red-500/10 mb-4">
                No Gym ID provided. You cannot register without a gym link.
              </div>
            ) : (
              <>
                {/* Google Sign In Section */}
                <div className="bg-white/[0.02] p-6 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/[0.04] mb-8">
                  {user ? (
                    <div className="flex flex-col">
                      <span className="text-xs text-[#8888A0]">Signed in as</span>
                      <span className="font-medium text-sm text-white">{user.email}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">Quick Registration</span>
                      <span className="text-xs text-[#8888A0]">Sign in to autofill your name and email</span>
                    </div>
                  )}
                  {user ? (
                    <Button type="button" variant="outline" size="sm" onClick={() => loginWithGoogle(true)} className="bg-transparent border-white/[0.08] hover:bg-white/[0.04]">
                      Switch account
                    </Button>
                  ) : (
                    <Button type="button" variant="secondary" onClick={() => loginWithGoogle()} className="bg-white hover:bg-white/90 text-black font-semibold">
                      Continue with Google
                    </Button>
                  )}
                </div>

                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(onSubmit, (errors) => {
                      console.error("Trial form validation errors:", errors);
                    })}
                    className="space-y-6"
                  >
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Mobile Number *</FormLabel>
                          <FormControl>
                            <Input type="tel" maxLength={10} placeholder="10-digit mobile number" {...field} className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-[#8888A0] font-medium">Gender *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                              {(["male", "female", "prefer-not-to-say"] as const).map((val) => (
                                <FormItem key={val} className="flex items-center space-x-3 space-y-0 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] cursor-pointer transition-all">
                                  <FormControl>
                                    <RadioGroupItem value={val} className="border-white/[0.2] text-[#B6916D]" />
                                  </FormControl>
                                  <FormLabel className="font-medium cursor-pointer capitalize text-sm">
                                    {val === "prefer-not-to-say" ? "Prefer not to say" : val.charAt(0).toUpperCase() + val.slice(1)}
                                  </FormLabel>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />


                    <FormField
                      control={form.control}
                      name="trialDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Trial Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="w-full bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" min={new Date().toISOString().split("T")[0]} />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" className="w-full h-12 bg-[#B6916D] hover:bg-[#B6916D]/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-[#B6916D]/20" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      Register for Trial
                    </Button>
                  </form>
                </Form>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
