"use client";

import { useState, useEffect } from "react";
import { UserPlus, Camera, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { addExactMonths } from "@/lib/utils";
import { generateMemberId } from "@/lib/member-id";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { doc, setDoc, collection, addDoc, getDocs, query, where, limit } from "firebase/firestore";
import { compressAndUploadPhoto } from "@/lib/cloudinary";
import { Member, Staff } from "@/types";
import { ToastAction } from "@/components/ui/toast";
import { sendMemberConfirmationEmail, sendWhatsAppConfirmation } from "@/app/register/actions";
import { sendWhatsAppTrialConfirmation } from "@/app/trial/actions";
import PaymentSplitter, { SplitPayment } from "../shared/PaymentSplitter";
import InstallmentManager from "../shared/InstallmentManager";
import { Installment } from "@/types";

const DEFAULT_ADD_FORM = {
  fullName: "", phone: "", email: "",
  gender: "male" as "male" | "female" | "other" | "prefer-not-to-say",
  dob: "", address: "",
  membershipType: "monthly" as Member["membershipType"],
  membershipStartDate: new Date().toISOString().split("T")[0],
  membershipEndDate: "",
  feesPaid: "", healthAssessment: "", isTakingMedication: "no",
  fitnessGoals: "", nickname: "",
  notes: "",
  trainingType: "general" as "general" | "personal",
  personalTrainerId: "",
  withGst: false,
  bloodGroup: "",
  profession: "",
  offerType: "",
  offerRemark: "",
  discountValue: "",
  discountType: "amount" as "amount" | "percentage",
  basePrice: "",
  ptGymFee: "2000",
};

function calculateEndDate(startDateStr: string, type: string): string {
  if (!startDateStr || type === "other") return "";
  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return "";
  
  let months = 0;
  if (type === "monthly") months = 1;
  else if (type === "quarterly") months = 3;
  else if (type === "half-yearly") months = 6;
  else if (type === "yearly") months = 12;
  else if (type === "trial") {
    const trialDate = new Date(startDate);
    trialDate.setDate(trialDate.getDate() + 1);
    return trialDate.toISOString().split("T")[0];
  }

  if (months > 0) {
    return addExactMonths(startDate, months).toISOString().split("T")[0];
  }
  return "";
}

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
  initialData?: Partial<typeof DEFAULT_ADD_FORM>;
  onSuccess?: (memberId: string) => void;
}

export default function AddMemberDialog({ open, onOpenChange, staff, initialData, onSuccess }: AddMemberDialogProps) {
  const router = useRouter();
  const { adminData, frontDeskData, activeGym } = useAuth();
  const { toast } = useToast();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [addForm, setAddForm] = useState({ ...DEFAULT_ADD_FORM });
  const [isAdding, setIsAdding] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [paymentSplits, setPaymentSplits] = useState<SplitPayment[]>([]);
  const [installments, setInstallments] = useState<Installment[]>([]);

  const baseP = Number(addForm.basePrice) || 0;
  const discV = Number(addForm.discountValue) || 0;
  const hasOff = !!addForm.offerType;
  let calculatedFinalFee = baseP;
  if (hasOff) {
    if (addForm.discountType === "percentage") {
      calculatedFinalFee = Math.max(0, Math.round(baseP - (baseP * discV / 100)));
    } else {
      calculatedFinalFee = Math.max(0, baseP - discV);
    }
  }

  useEffect(() => {
    if (open) {
      const mergedData = { ...DEFAULT_ADD_FORM, ...initialData };
      if (initialData?.membershipStartDate && initialData?.membershipType) {
        mergedData.membershipEndDate = calculateEndDate(initialData.membershipStartDate, initialData.membershipType);
      } else if (mergedData.membershipStartDate && mergedData.membershipType) {
        mergedData.membershipEndDate = calculateEndDate(mergedData.membershipStartDate, mergedData.membershipType);
      }
      setAddForm(mergedData);
      
      // If initialData has a photoUrl, we could handle it, but usually for new members it's a file upload
      setPhotoFile(null);
      setPhotoPreview(null);
      setInstallments([]);
      setPaymentSplits([]);
    }
  }, [open, initialData]);

  const handleAddFormChange = (field: string, value: any) => {
    setAddForm(prev => {
      const updated = { ...prev, [field]: value };

      // Auto-calculation logic
      if (["basePrice", "discountValue", "discountType", "offerType"].includes(field)) {
        const base = Number(updated.basePrice) || 0;
        const discValue = Number(updated.discountValue) || 0;
        const discType = updated.discountType;
        const hasOffer = !!updated.offerType;

        if (!hasOffer) {
          updated.feesPaid = String(base);
        } else {
          if (discType === "percentage") {
            updated.feesPaid = String(Math.max(0, Math.round(base - (base * discValue / 100))));
          } else {
            updated.feesPaid = String(Math.max(0, base - discValue));
          }
        }
      }

      if (field === "membershipStartDate" || field === "membershipType") {
        const start = field === "membershipStartDate" ? value : prev.membershipStartDate;
        const type = field === "membershipType" ? value : prev.membershipType;
        const endDate = calculateEndDate(start, type);
        if (endDate) updated.membershipEndDate = endDate;
      }
      return updated;
    });
  };

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

  const handleAddMember = async () => {
    if (!gymId) return;
    const { fullName, phone, email, gender, membershipType, membershipStartDate, membershipEndDate, bloodGroup, profession, feesPaid } = addForm;
    if (!fullName || !phone || !membershipStartDate || !membershipEndDate || !feesPaid) {
      toast({ title: "Missing Fields", description: "Please fill in all required fields (Name, Phone, Dates, Fees Paid).", variant: "destructive" });
      return;
    }

    if (addForm.trainingType === "personal") {
      if (!addForm.ptGymFee) {
        toast({ title: "Missing Fields", description: "Base Gym Fee is required for Personal Training.", variant: "destructive" });
        return;
      }
      
      let months = 1;
      if (membershipType === "monthly") months = 1;
      else if (membershipType === "quarterly") months = 3;
      else if (membershipType === "half-yearly") months = 6;
      else if (membershipType === "yearly") months = 12;

      const monthlyFee = calculatedFinalFee / months;
      if (monthlyFee <= (Number(addForm.ptGymFee) * 2)) {
        toast({ 
          title: "Invalid Fee", 
          description: `Total Monthly PT fee (₹${monthlyFee.toFixed(0)}) must be strictly greater than double of Base Gym Fees (₹${Number(addForm.ptGymFee) * 2}).`, 
          variant: "destructive" 
        });
        return;
      }
    }

    const totalSplitAmount = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    if (totalSplitAmount !== Number(feesPaid)) {
      toast({ title: "Payment Mismatch", description: `Split amounts (₹${totalSplitAmount}) must sum up to Total Fees Paid (₹${feesPaid}).`, variant: "destructive" });
      return;
    }

    const sumInstallments = installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    if (Number(feesPaid) + sumInstallments !== calculatedFinalFee) {
      toast({ title: "Balance Mismatch", description: `Paid Today + Installments must perfectly equal the Payable Amount (₹${calculatedFinalFee}).`, variant: "destructive" });
      return;
    }

    if (paymentSplits.some(s => !s.receivedBy)) {
      toast({ title: "Recipient Missing", description: "Please select a recipient for all partial payments.", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    const { dismiss } = toast({ title: "Adding Member...", description: "Compressing and uploading photo.", duration: Infinity });
    try {
      const memberId = generateMemberId(fullName, phone);
      const archiveRef = collection(db, "archives", gymId, "members");
      
      const archivedPhone = await getDocs(query(archiveRef, where("phone", "==", phone), limit(1)));
      if (!archivedPhone.empty) {
        dismiss();
        toast({
          title: "Archived member found",
          description: "This phone belongs to a previously deleted member. Restore from archive instead of re-adding.",
          action: (
            <ToastAction altText="Open archive" onClick={() => router.push(`/admin/archives/${archivedPhone.docs[0].id}`)}>
              Open archive
            </ToastAction>
          ),
          variant: "destructive"
        });
        setIsAdding(false);
        return;
      }

      const phoneSnap = await getDocs(query(collection(db, "gyms", gymId, "members"), where("phone", "==", phone)));
      if (!phoneSnap.empty) { dismiss(); toast({ title: "Duplicate", description: "A member with this phone number already exists.", variant: "destructive" }); setIsAdding(false); return; }
      
      let photoUrl = "";
      if (photoFile) { photoUrl = await compressAndUploadPhoto(photoFile, gymId, memberId); }
      
      const now = new Date().toISOString();
      const initialPlan = {
        planType: membershipType as string,
        startDate: membershipStartDate,
        endDate: membershipEndDate,
        amountPaid: Number(addForm.feesPaid) || 0,
        trainingType: addForm.trainingType,
        personalTrainerId: addForm.trainingType === "personal" ? addForm.personalTrainerId : null,
        withGst: !!addForm.withGst,
        offerType: addForm.offerType,
        offerRemark: addForm.offerRemark,
        discountValue: addForm.discountValue,
        discountType: addForm.discountType,
        basePrice: Number(addForm.basePrice) || 0,
        paymentSplits: paymentSplits,
        ptGymFee: addForm.trainingType === "personal" ? Number(addForm.ptGymFee) : 0,
        installments: installments,
      };

      const memberData: Omit<Member, "memberId"> = {
        gymId, fullName, nickname: addForm.nickname || "", email: email || "", phone,
        address: addForm.address || "", dob: addForm.dob || "", gender: gender as Member["gender"],
        membershipType: membershipType as Member["membershipType"], membershipStartDate, membershipEndDate,
        healthAssessment: addForm.healthAssessment || "",
        isTakingMedication: addForm.isTakingMedication || "no", fitnessGoals: addForm.fitnessGoals || "",
        selfDeclaration: true, createdAt: now, feesPaid: Number(addForm.feesPaid) || 0, isAcknowledged: false, photoUrl,
        notes: addForm.notes || "",
        trainingType: addForm.trainingType,
        personalTrainerId: addForm.trainingType === "personal" ? addForm.personalTrainerId : "",
        withGst: !!addForm.withGst,
        paymentOption: paymentSplits[0]?.paymentMode || "cash",
        planHistory: [initialPlan],
        bloodGroup: bloodGroup || "",
        profession: profession || "",
        offerType: addForm.offerType || "",
        offerRemark: addForm.offerRemark || "",
        discountValue: addForm.discountValue || "",
        discountType: addForm.discountType,
        basePrice: Number(addForm.basePrice) || 0,
        paymentSplits: paymentSplits,
        ptGymFee: addForm.trainingType === "personal" ? Number(addForm.ptGymFee) : 0,
        installments: installments,
      };
      await setDoc(doc(db, "gyms", gymId, "members", memberId), memberData);
      
      if (paymentSplits.length > 0) {
        const sharedInvoiceId = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
        for (const split of paymentSplits) {
          if (Number(split.amount) > 0) {
            await addDoc(collection(db, "gyms", gymId, "payments"), { 
              memberId, 
              amount: Number(split.amount), 
              date: now, 
              type: "joining_fee",
              invoiceId: sharedInvoiceId,
              planType: membershipType,
              startDate: membershipStartDate,
              endDate: membershipEndDate,
              withGst: addForm.withGst,
              receivedBy: split.receivedBy,
              paymentMode: split.paymentMode || "cash"
            });
          }
        }
      }
      dismiss();
      toast({ title: "Success!", description: `${fullName} has been registered.` });

      // Send confirmation email to member if email provided
      if (email) {
        try {
          // Fetch actual gym name for branding
          const gymSnap = await getDocs(query(collection(db, "gyms"), where("__name__", "==", gymId), limit(1)));
          const gymName = !gymSnap.empty ? (gymSnap.docs[0].data().name || gymId) : "the Gym";
          
          await sendMemberConfirmationEmail(
            email,
            fullName,
            gymName,
            { ...memberData, memberId } as any,
            membershipEndDate,
            paymentSplits
          );
        } catch (err) {
          console.error("Failed to send member email:", err);
        }
      }

      // Send WhatsApp confirmation
      try {
        const gymSnap = await getDocs(query(collection(db, "gyms"), where("__name__", "==", gymId), limit(1)));
        const gymName = !gymSnap.empty ? (gymSnap.docs[0].data().name || gymId) : "the Gym";

        if (membershipType === "trial") {
          await sendWhatsAppTrialConfirmation(
            phone,
            fullName,
            gymName,
            membershipStartDate,
            {
              email: email || "",
              gender: gender || "",
              phone: phone,
              feesPaid: Number(addForm.feesPaid) || 0
            },
            paymentSplits as any
          );
        } else {
          await sendWhatsAppConfirmation(
            phone,
            fullName,
            gymName,
            { ...memberData, memberId } as any,
            membershipEndDate,
            paymentSplits as any
          );
        }
      } catch (err) {
        console.error("Failed to send WhatsApp confirmation:", err);
      }

      // Trainer notification logic...
      if (addForm.trainingType === "personal" && addForm.personalTrainerId) {
        const selectedTrainer = staff.find(s => s.staffId === addForm.personalTrainerId);
        if (selectedTrainer && selectedTrainer.email) {
          try {
            let months = 1;
            if (membershipType === "monthly") months = 1;
            else if (membershipType === "quarterly") months = 3;
            else if (membershipType === "half-yearly") months = 6;
            else if (membershipType === "yearly") months = 12;

            const totalFee = Number(addForm.feesPaid || 0);
            const monthlyFee = totalFee / months;
            const gstDeduction = addForm.withGst ? (monthlyFee * 0.05) : 0;
            const baseGymFee = Number(addForm.ptGymFee) || 2000;
            const earnings = (monthlyFee - baseGymFee - gstDeduction) * 0.5;

            await fetch("/api/notify-trainer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                gymId,
                trainerEmail: selectedTrainer.email,
                trainerName: selectedTrainer.fullName,
                trainerPhone: selectedTrainer.phone,
                memberName: fullName,
                earnings: earnings > 0 ? earnings : 0,
                startDate: membershipStartDate,
                endDate: membershipEndDate
              })
            });
          } catch (e) {
            console.error("Failed to notify trainer:", e);
          }
        }
      }

      onSuccess?.(memberId);
      onOpenChange(false);
    } catch (error) {
      dismiss();
      console.error("Error adding member:", error);
      toast({ title: "Error", description: "Failed to add member.", variant: "destructive" });
    } finally { setIsAdding(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isAdding && onOpenChange(o)}>
      <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-[#B6916D]" />Add New Member</DialogTitle>
          <DialogDescription className="text-[#8888A0]">
            Fill in the member's details. Member ID will be auto-generated.
            {addForm.fullName && addForm.phone && (<span className="ml-1 font-semibold text-[#B6916D]">ID Preview: <span className="font-mono">{generateMemberId(addForm.fullName, addForm.phone)}</span></span>)}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center justify-center gap-4 p-4 border border-dashed border-white/[0.1] rounded-lg bg-white/[0.02]">
            {photoPreview ? (
              <div className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-[#B6916D]">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-0 right-0 bg-black/50 text-white p-1 rounded-full hover:bg-black/80"><X className="h-4 w-4" /></button>
              </div>
            ) : (
              <Label htmlFor="photo-upload-diag" className="flex flex-col items-center gap-4 cursor-pointer group">
                <div className="w-32 h-32 rounded-full bg-white/[0.04] flex items-center justify-center border-2 border-white/[0.1] group-hover:border-[#B6916D]/50 transition-colors"><Camera className="h-10 w-10 text-[#8888A0] group-hover:text-[#B6916D]" /></div>
                <span className="text-sm font-medium text-[#8888A0]">Upload Member Photo (Optional)</span>
                <input id="photo-upload-diag" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </Label>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Full Name <span className="text-destructive">*</span></Label><Input placeholder="e.g. Virat Kohli" value={addForm.fullName} onChange={(e) => handleAddFormChange("fullName", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Nickname</Label><Input placeholder="Optional" value={addForm.nickname} onChange={(e) => handleAddFormChange("nickname", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Phone Number <span className="text-destructive">*</span></Label><Input placeholder="e.g. 9876543210" value={addForm.phone} onChange={(e) => handleAddFormChange("phone", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Email</Label><Input type="email" placeholder="e.g. virat@email.com" value={addForm.email} onChange={(e) => handleAddFormChange("email", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Gender</Label><Select value={addForm.gender} onValueChange={(v) => handleAddFormChange("gender", v || "")}><SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white"><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem><SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Date of Birth</Label><Input type="date" value={addForm.dob} onChange={(e) => handleAddFormChange("dob", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label className="text-[#8888A0]">Address</Label><Input placeholder="e.g. 123 Main St, Mumbai" value={addForm.address} onChange={(e) => handleAddFormChange("address", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Membership Start Date <span className="text-destructive">*</span></Label><Input type="date" value={addForm.membershipStartDate} onChange={(e) => handleAddFormChange("membershipStartDate", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Membership Plan <span className="text-destructive">*</span></Label><Select value={addForm.membershipType} onValueChange={(v) => handleAddFormChange("membershipType", v || "")}><SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white"><SelectItem value="monthly">Monthly (30 Days)</SelectItem><SelectItem value="quarterly">Quarterly (90 Days)</SelectItem><SelectItem value="half-yearly">Half-Yearly (180 Days)</SelectItem><SelectItem value="yearly">Yearly (365 Days)</SelectItem><SelectItem value="other">Other / Custom</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Membership End Date <span className="text-destructive">*</span></Label><Input type="date" value={addForm.membershipEndDate} onChange={(e) => handleAddFormChange("membershipEndDate", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Training Type</Label><Select value={addForm.trainingType} onValueChange={(v) => handleAddFormChange("trainingType", v || "")}><SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white"><SelectItem value="general">General Training</SelectItem><SelectItem value="personal">Personal Training</SelectItem></SelectContent></Select></div>
            
            {addForm.trainingType === "personal" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[#8888A0]">Select Trainer <span className="text-destructive">*</span></Label>
                  <Select value={addForm.personalTrainerId} onValueChange={(v) => handleAddFormChange("personalTrainerId", v || "")}>
                    <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                      <SelectValue placeholder="Choose Trainer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      {staff.filter(s => s.role === "Trainer").map(trainer => (
                        <SelectItem key={trainer.staffId} value={trainer.staffId}>{trainer.fullName}</SelectItem>
                      ))}
                      {staff.filter(s => s.role === "Trainer").length === 0 && ( <div className="p-2 text-sm text-muted-foreground text-center">No trainers available</div> )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8888A0]">Base Gym Fee (per month) <span className="text-destructive">*</span></Label>
                  <Input 
                    type="number" 
                    placeholder="e.g. 2000" 
                    value={addForm.ptGymFee} 
                    onChange={(e) => handleAddFormChange("ptGymFee", e.target.value)} 
                    className="bg-white/[0.04] border-white/[0.08] text-white" 
                  />
                  <p className="text-[10px] text-[#8888A0] italic">This amount is deducted from the monthly PT fee for gym profit share.</p>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Standard Fee (Base Price) (₹) <span className="text-destructive">*</span></Label>
              <Input 
                type="number" 
                placeholder="e.g. 2200" 
                value={addForm.basePrice} 
                onChange={(e) => handleAddFormChange("basePrice", e.target.value)} 
                className="bg-white/[0.04] border-white/[0.08] text-white" 
              />
            </div>

            <div className="space-y-1.5"><Label className="text-[#8888A0]">Offer Type</Label><Select value={addForm.offerType || "none"} onValueChange={(v) => handleAddFormChange("offerType", v === "none" ? "" : v)}><SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white"><SelectValue placeholder="Select Offer" /></SelectTrigger><SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white"><SelectItem value="none">No Offer</SelectItem><SelectItem value="Student">Student</SelectItem><SelectItem value="Couple">Couple</SelectItem><SelectItem value="Combo">Combo</SelectItem><SelectItem value="Individual">Individual</SelectItem><SelectItem value="Group">Group</SelectItem></SelectContent></Select></div>
            {addForm.offerType && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-[#8888A0]">Discount Type</Label>
                  <Select value={addForm.discountType} onValueChange={(v) => handleAddFormChange("discountType", v)}>
                    <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      <SelectItem value="amount">Fixed Amount (₹)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[#8888A0]">Discount Value</Label>
                  <Input 
                    type="number"
                    placeholder={addForm.discountType === "percentage" ? "e.g. 10" : "e.g. 500"} 
                    value={addForm.discountValue} 
                    onChange={(e) => handleAddFormChange("discountValue", e.target.value)} 
                    className="bg-white/[0.04] border-white/[0.08] text-white" 
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[#8888A0]">Offer Remark</Label>
                  <textarea 
                    placeholder="e.g. Student discount applied after ID check" 
                    value={addForm.offerRemark} 
                    onChange={(e) => handleAddFormChange("offerRemark", e.target.value)} 
                    className="w-full min-h-[80px] p-3 rounded-md bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-white/20 text-sm"
                  />
                </div>
              </>
            )}
            {addForm.offerType && (
              <div className="space-y-1 sm:col-span-2 px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-md">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Standard Fee:</span>
                  <span className="text-white font-medium">₹{(Number(addForm.basePrice) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Discount Amount:</span>
                  <span className="text-red-400 font-medium">
                    -₹{(addForm.discountType === "percentage" 
                      ? Math.round((Number(addForm.basePrice) * Number(addForm.discountValue)) / 100)
                      : Number(addForm.discountValue) || 0
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-bold border-t border-white/[0.04] mt-1 pt-1">
                  <span className="text-[#B6916D]">Calculated Payable:</span>
                  <span className="text-[#B6916D]">₹{calculatedFinalFee.toLocaleString()}</span>
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Paid Today / Upfront (₹) <span className="text-destructive">*</span></Label>
              <Input 
                type="number" 
                min="0" 
                placeholder="e.g. 1500" 
                value={addForm.feesPaid} 
                onChange={(e) => handleAddFormChange("feesPaid", e.target.value)} 
                className="bg-[#B6916D]/10 border-[#B6916D]/30 text-white font-bold" 
                required 
              />
            </div>
            
            <div className="sm:col-span-2">
              <PaymentSplitter 
                recipients={activeGym?.paymentRecipients || []}
                initialTotal={Number(addForm.feesPaid) || 0}
                onChange={setPaymentSplits}
              />
            </div>

            <div className="sm:col-span-2 pt-2">
              <InstallmentManager 
                installments={installments}
                onChange={setInstallments}
                payableAmount={calculatedFinalFee}
                paidAmount={Number(addForm.feesPaid) || 0}
              />
            </div>

            <div className="space-y-1.5"><Label className="text-[#8888A0]">Taking Medication?</Label><Select value={addForm.isTakingMedication} onValueChange={(v) => handleAddFormChange("isTakingMedication", v || "")}><SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger><SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white"><SelectItem value="no">No</SelectItem><SelectItem value="yes">Yes</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Blood Group</Label><Input placeholder="e.g. O+" value={addForm.bloodGroup} onChange={(e) => handleAddFormChange("bloodGroup", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Profession</Label><Input placeholder="e.g. Software Engineer" value={addForm.profession} onChange={(e) => handleAddFormChange("profession", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Health Assessment</Label><Input placeholder="e.g. Good health, no issues" value={addForm.healthAssessment} onChange={(e) => handleAddFormChange("healthAssessment", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5"><Label className="text-[#8888A0]">Fitness Goals</Label><Input placeholder="e.g. Weight loss, muscle gain" value={addForm.fitnessGoals} onChange={(e) => handleAddFormChange("fitnessGoals", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
            <div className="space-y-1.5 flex items-center gap-2 pt-6">
              <input 
                type="checkbox" 
                id="withGst" 
                checked={addForm.withGst} 
                onChange={(e) => handleAddFormChange("withGst", e.target.checked as any)}
                className="w-4 h-4 rounded border-white/[0.08] bg-white/[0.04] text-[#B6916D] focus:ring-[#B6916D]"
              />
              <Label htmlFor="withGst" className="text-[#8888A0] cursor-pointer">Generate GST Invoice</Label>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[#8888A0]">Notes</Label>
              <textarea 
                placeholder="Additional notes about the member..." 
                value={addForm.notes} 
                onChange={(e) => handleAddFormChange("notes", e.target.value)} 
                className="w-full min-h-[100px] p-3 rounded-md bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-white/20"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="pt-4 border-t border-white/[0.08] flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding} className="w-full sm:w-auto bg-transparent border-white/[0.08] text-[#8888A0] hover:bg-white/[0.04]">Cancel</Button>
          <Button 
            onClick={handleAddMember} 
            disabled={
              isAdding || 
              (paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) !== (Number(addForm.feesPaid) || 0)) ||
              paymentSplits.some(s => !s.receivedBy) ||
              ((Number(addForm.feesPaid) || 0) + installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) !== calculatedFinalFee)
            } 
            className="w-full sm:w-auto gap-2 bg-[#B6916D] hover:bg-[#B6916D]/90 text-white"
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            {isAdding ? "Adding Member..." : "Add Member"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
