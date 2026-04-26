"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { Camera, X } from "lucide-react";
import { compressAndUploadPhoto } from "@/lib/cloudinary";
import { generateMemberId } from "@/lib/member-id";

const formSchema = z.object({
  fullName: z.string().min(2, "Full Name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Phone must be exactly 10 digits starting with 6, 7, 8, or 9"),
  address: z.string().min(5, "Residential Address is required"),
  dob: z.string().optional(),
  gender: z.string().refine((val) => ["male", "female", "prefer-not-to-say"].includes(val), {
    message: "Gender is required",
  }),
  membershipStartDate: z.string().min(1, "Start Date is required"),
  membershipType: z.string().refine((val) => ["trial", "monthly", "quarterly", "half-yearly", "yearly", "other"].includes(val), {
    message: "Membership Type is required",
  }),
  membershipTypeOther: z.string().optional(),
  healthAssessment: z.string().min(1, "Health assessment is required"),
  isTakingMedication: z.string().min(1, "Please select an option"),
  fitnessGoals: z.string().optional(),
  selfDeclaration: z.boolean().refine((val) => val === true, {
    message: "You must agree to the self-declaration",
  }),
}).refine((data) => {
  const startDate = new Date(data.membershipStartDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time for comparison
  return startDate >= today;
}, {
  message: "Membership start date cannot be in the past",
  path: ["membershipStartDate"],
});

export default function RegisterPage() {
  const [gymId, setGymId] = useState<string | null>(null);
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { user, loginWithGoogle } = useAuth();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
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

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select an image under 10MB.", variant: "destructive" });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      address: "",
      dob: "",
      gender: "",
      membershipStartDate: new Date().toISOString().split("T")[0],
      membershipType: "",
      membershipTypeOther: "",
      healthAssessment: "",
      isTakingMedication: "",
      fitnessGoals: "",
      selfDeclaration: false,
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

  const watchMembershipType = form.watch("membershipType");

    const { toast } = useToast();
  
  
    async function onSubmit(values: z.infer<typeof formSchema>) {
      if (!user) {
        toast({ title: "Authentication Required", description: "Please click 'Continue with Google' at the top.", variant: "destructive" });
        return;
      }

      if (!gymId) {
        toast({ title: "Error", description: "Invalid gym ID.", variant: "destructive" });
        return;
      }

      if (!photoFile) {
        toast({ title: "Photo Required", description: "Please upload your photo.", variant: "destructive" });
        return;
      }
  
      setIsLoading(true);
      const { dismiss } = toast({ title: "Registering...", description: "Please wait while we process your photo.", duration: Infinity });
      
      try {
        const memberId = generateMemberId(values.fullName, values.phone);
        
        // 1. Upload/Compress Photo
        console.log("Step 1: Photo compression & upload");
        const photoUrl = await compressAndUploadPhoto(photoFile, gymId, memberId);

        // 2. Save Data
        console.log("Step 2: Saving register details");
        toast({ title: "Saving...", description: "Recording your membership details." });
        
        const { registerMember } = await import("./actions");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await registerMember(gymId, values as any, photoUrl);

        dismiss();

        if (!result.success) {
          if (result.code === "archived") {
            toast({ title: "Already registered", description: "Already registered, contact admin.", variant: "destructive" });
          }
          if (result.field) {
            form.setError(result.field as any, { message: result.error });
          } else {
            toast({ title: "Error", description: result.error, variant: "destructive" });
          }
          setIsLoading(false);
          return;
        }
  
        toast({ title: "Success", description: "Welcome to the family!" });
        setIsSuccess(true);
      } catch (error) {
        dismiss();
        console.error("Error submitting registration:", error);
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
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#B6916D] to-[#B6916D]/60 bg-clip-text text-transparent">Congratulations!</CardTitle>
            <CardDescription className="text-[#8888A0]">
              Welcome to the {gymData?.name || "GymManagr"} family. Your membership has been registered successfully.
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
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-center mb-10 gap-2">
          <Image src={gymData?.logoUrl || "/gymmanagr-logo.png"} alt={gymData?.name || "GymManagr"} width={200} height={50} className="h-20 w-auto object-contain" priority />
        </div>

        <Card className="bg-[#1A1A2E]/80 border-white/[0.08] text-white backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-2xl font-bold">Member Registration</CardTitle>
            <CardDescription className="text-[#8888A0]">
              {gymData ? `Registering for ${gymData.name}` : gymId ? `Loading gym details...` : "Please use a valid gym registration link."}
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
                      <span className="text-xs text-[#8888A0]">Draft saved as</span>
                      <span className="font-medium text-sm text-white">{user.email}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-white">Save time registering</span>
                      <span className="text-xs text-[#8888A0]">Autofill your name and email</span>
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

                {/* Photo Upload Section */}
                <div className="mb-10 p-8 bg-white/[0.02] border-2 border-dashed border-white/[0.1] rounded-2xl flex flex-col items-center gap-4 transition-all hover:bg-white/[0.04] hover:border-[#B6916D]/30">
                  {photoPreview ? (
                    <div className="relative w-44 h-44 rounded-full overflow-hidden ring-4 ring-[#B6916D]/20 ring-offset-4 ring-offset-[#0F1117]">
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                        className="absolute top-2 right-2 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <label htmlFor="photo-upload" className="flex flex-col items-center gap-4 cursor-pointer group">
                      <div className="w-32 h-32 rounded-full bg-[#0F0F1A] flex items-center justify-center border-2 border-white/[0.08] group-hover:border-[#B6916D]/50 transition-all shadow-xl">
                        <Camera className="h-12 w-12 text-[#8888A0] group-hover:text-[#B6916D] transition-colors" />
                      </div>
                      <div className="text-center">
                        <span className="text-sm font-bold text-white block">Upload your Photo *</span>
                        <p className="text-xs text-[#8888A0] mt-1">Required for gym record</p>
                      </div>
                      <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                    </label>
                  )}
                </div>

                <Form {...form}>
                <form 
                  onSubmit={form.handleSubmit(onSubmit, (errors) => {
                    console.error("Registration form validation errors:", errors);
                  })} 
                  className="space-y-8"
                >
                  <div className="space-y-8">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Full Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Your full name" {...field} className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" />
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
                          <FormLabel className="text-[#8888A0] font-medium">Phone Number *</FormLabel>
                          <FormControl>
                            <Input type="tel" maxLength={10} placeholder="10-digit mobile number" {...field} className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="address"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Residential Address *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Street, City, Zip Code" {...field} className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50 min-h-[100px]" />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="dob"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Date of Birth</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="w-full bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" />
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
                                    <RadioGroupItem
                                      value={val}
                                      onClick={() => field.value === val && field.onChange("")}
                                      className="border-white/[0.2] text-[#B6916D]"
                                    />
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
                      name="membershipStartDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Membership Start Date *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="w-full bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="membershipType"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-[#8888A0] font-medium">Membership Plan *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                            >
                              {([
                                { value: "monthly", label: "Monthly" },
                                { value: "quarterly", label: "Quarterly (3 Months)" },
                                { value: "half-yearly", label: "6 Months" },
                                { value: "yearly", label: "Yearly" },
                                { value: "other", label: "Custom duration" },
                              ]).map((opt) => (
                                <FormItem key={opt.value} className="flex items-center space-x-3 space-y-0 p-4 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] cursor-pointer transition-all">
                                  <FormControl>
                                    <RadioGroupItem
                                      value={opt.value}
                                      className="border-white/[0.2] text-[#B6916D]"
                                      onClick={() => field.value === opt.value && field.onChange("")}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-medium cursor-pointer text-sm">{opt.label}</FormLabel>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    {watchMembershipType === "other" && (
                      <FormField
                        control={form.control}
                        name="membershipTypeOther"
                        render={({ field }) => (
                          <FormItem className="animate-in fade-in slide-in-from-top-2 duration-200">
                            <FormLabel className="text-[#8888A0] font-medium">Number of months *</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                min="1"
                                max="120"
                                placeholder="e.g. 2"
                                {...field}
                                onChange={e => field.onChange(e.target.value)}
                                className="bg-white/[0.04] border-white/[0.08] text-white"
                              />
                            </FormControl>
                            <FormMessage className="text-red-400" />
                          </FormItem>
                        )}
                      />
                    )}


                    <FormField
                      control={form.control}
                      name="healthAssessment"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-[#8888A0] font-medium">Health Assessment: Any injuries or medical conditions? *</FormLabel>
                          <FormControl>
                            <Textarea placeholder="No, I am fit and healthy." {...field} className="bg-white/[0.04] border-white/[0.08] text-white min-h-[80px]" />
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="isTakingMedication"
                      render={({ field }) => (
                        <FormItem className="space-y-4">
                          <FormLabel className="text-[#8888A0] font-medium">Are you taking any prescription medication? *</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex gap-4"
                            >
                              {(["yes", "no"] as const).map((val) => (
                                <FormItem key={val} className="flex-1 flex items-center space-x-3 space-y-0 p-3 rounded-xl bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.04] cursor-pointer transition-all">
                                  <FormControl>
                                    <RadioGroupItem
                                      value={val}
                                      className="border-white/[0.2] text-[#B6916D]"
                                      onClick={() => field.value === val && field.onChange("")}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-medium cursor-pointer capitalize text-sm">{val}</FormLabel>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage className="text-red-400" />
                        </FormItem>
                      )}
                    />

                    <div className="space-y-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#B6916D]" />
                        Declaration & Terms
                      </h4>
                      <ol className="list-decimal list-inside space-y-3 text-xs text-[#8888A0] leading-relaxed">
                        <li>The gym management is not responsible for any loss or damage to personal belongings.</li>
                        <li>I declare that I am not using any illegal performance-enhancing substances.</li>
                        <li>I confirm that the health information provided is true.</li>
                        <li>Vehicle parking is at the owner's risk.</li>
                        <li>Fees once paid are <span className="text-white font-bold">non-refundable and non-transferable</span>.</li>
                      </ol>

                      <div className="pt-2">
                        <p className="text-[11px] text-[#55556F]">
                          Review full <Link href={`/terms-of-use${gymData?.name ? `?gym=${encodeURIComponent(gymData.name)}` : ''}`} target="_blank" className="text-[#B6916D] hover:underline">Terms of Service</Link>
                        </p>
                      </div>
                      
                      <FormField
                        control={form.control}
                        name="selfDeclaration"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-3 space-y-0 p-4 bg-[#B6916D]/5 rounded-xl border border-[#B6916D]/10">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                                className="border-[#B6916D]/50 data-[state=checked]:bg-[#B6916D]"
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="cursor-pointer text-sm font-semibold text-white">
                                I Agree to all terms
                              </FormLabel>
                              <FormMessage className="text-red-400 text-xs" />
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full h-12 bg-[#B6916D] hover:bg-[#B6916D]/90 text-white font-bold text-lg rounded-xl shadow-lg shadow-[#B6916D]/20" disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                    Submit Registration
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
