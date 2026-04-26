"use client";

import { useState, useEffect } from "react";
import { format, isAfter, startOfDay } from "date-fns";
import { addExactMonths, formatDateOnly } from "@/lib/utils";
import { Member, Staff } from "@/types";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/hooks/use-toast";
import { sendMemberConfirmationEmail, sendWhatsAppConfirmation, getRegistrationWhatsAppTextAction } from "@/app/register/actions";
import { getTrialWhatsAppTextAction } from "@/app/trial/actions";
import PaymentSplitter, { SplitPayment } from "@/components/admin/shared/PaymentSplitter";
import InstallmentManager from "@/components/admin/shared/InstallmentManager";
import { Installment } from "@/types";
import FamilyManager from "./shared/FamilyManager";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { ToastAction } from "@/components/ui/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RefreshCw, Loader2 } from "lucide-react";

interface RenewMembershipPopoverProps {
  member: Member;
  triggerElement?: React.ReactNode;
  onUpdate?: () => void;
  onActive?: (isActive: boolean) => void;
  align?: "center" | "start" | "end";
}

const RENEWAL_OPTIONS = [
  { label: "1 Month", months: 1 },
  { label: "3 Months", months: 3 },
  { label: "6 Months", months: 6 },
  { label: "1 Year", months: 12 },
];

export default function RenewMembershipPopover({
  member,
  triggerElement,
  onUpdate,
  onActive,
  align = "end"
}: RenewMembershipPopoverProps) {
  const { adminData, activeGym, frontDeskData } = useAuth();
  const { toast } = useToast();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  
  const [open, setOpen] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [customStartDate, setCustomStartDate] = useState("");
  const [customDate, setCustomDate] = useState("");
  const [renewalFee, setRenewalFee] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [discountType, setDiscountType] = useState<"amount" | "percentage">("amount");
  const [withGst, setWithGst] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [trainingType, setTrainingType] = useState<"general" | "personal">(member.trainingType || (member.personalTrainerId ? "personal" : "general"));
  const [personalTrainerId, setPersonalTrainerId] = useState<string>(member.personalTrainerId || "");
  const [staff, setStaff] = useState<Staff[]>([]);
  const [renewalPaymentSplits, setRenewalPaymentSplits] = useState<SplitPayment[]>([]);
  const [offerType, setOfferType] = useState<string>(member.offerType || "");
  const [offerRemark, setOfferRemark] = useState<string>(member.offerRemark || "");
  const [discountValue, setDiscountValue] = useState<string>(member.discountValue || "");
  const [ptGymFee, setPtGymFee] = useState<string>(member.ptGymFee?.toString() || "2000");
  const [familyMemberIds, setFamilyMemberIds] = useState<string[]>(member.familyMemberIds || []);
  const [installments, setInstallments] = useState<Installment[]>([]);

  const baseP = Number(basePrice) || 0;
  const discV = Number(discountValue) || 0;
  const hasOff = !!offerType;
  let calculatedFinalFee = baseP;
  if (hasOff) {
    if (discountType === "percentage") {
      calculatedFinalFee = Math.max(0, Math.round(baseP - (baseP * discV / 100)));
    } else {
      calculatedFinalFee = Math.max(0, baseP - discV);
    }
  }

  useEffect(() => {
    async function fetchStaff() {
      if (!gymId) return;
      try {
        const q = query(collection(db, "gyms", gymId, "staff"), where("role", "==", "Trainer"));
        const snapshot = await getDocs(q);
        const staffData = snapshot.docs.map(d => ({ staffId: d.id, ...d.data() }) as Staff);
        setStaff(staffData);
      } catch (err) {
        console.error("Error fetching staff:", err);
      }
    }
    if (open) fetchStaff();
  }, [open, gymId]);

  useEffect(() => {
    if (open) {
      setFamilyMemberIds(member.familyMemberIds || []);
    }
  }, [open, member.familyMemberIds]);

  useEffect(() => {
    const base = Number(basePrice) || 0;
    const discValue = Number(discountValue) || 0;
    const hasOffer = !!offerType;

    if (!hasOffer) {
      setRenewalFee(String(base));
    } else {
      if (discountType === "percentage") {
        setRenewalFee(String(Math.max(0, Math.round(base - (base * discValue / 100)))));
      } else {
        setRenewalFee(String(Math.max(0, base - discValue)));
      }
    }
  }, [basePrice, discountValue, discountType, offerType]);

  // If currently active, renew from current end. Else renew from today.
  const today = startOfDay(new Date());
  const currentEnd = startOfDay(new Date(member.membershipEndDate));
  const autoRenewStartDate = isAfter(currentEnd, today) ? currentEnd : today;
  // Use the custom start date if provided, otherwise fall back to auto-calculated
  const renewStartDate = customStartDate ? startOfDay(new Date(customStartDate)) : autoRenewStartDate;

  const getNewEndDate = (): string | null => {
    if (customDate) return customDate;
    if (selectedMonths !== null) {
      return formatDateOnly(addExactMonths(renewStartDate, selectedMonths));
    }
    return null;
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    onActive?.(isOpen);
    if (!isOpen) {
      setSelectedMonths(null);
      setCustomStartDate("");
      setCustomDate("");
      setRenewalFee("");
      setBasePrice("");
      setDiscountType("amount");
      setWithGst(false);
      setTrainingType(member.trainingType || (member.personalTrainerId ? "personal" : "general"));
      setPersonalTrainerId(member.personalTrainerId || "");
      setOfferType("");
      setOfferRemark(member.offerRemark || "");
      setDiscountValue("");
      setPtGymFee(member.ptGymFee?.toString() || "2000");
      setInstallments([]);
      setRenewalPaymentSplits([]);
    }
  };

  const onAddFamily = async (otherId: string) => {
    if (!gymId || !member) return;
    try {
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      const otherRef = doc(db, "gyms", gymId, "members", otherId);
      await updateDoc(memberRef, { familyMemberIds: arrayUnion(otherId) });
      await updateDoc(otherRef, { familyMemberIds: arrayUnion(member.memberId) });
      setFamilyMemberIds(prev => prev.includes(otherId) ? prev : [...prev, otherId]);
      toast({ title: "Family Linked", description: "Profile bidirectional connection established." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to link profile.", variant: "destructive" });
    }
  };

  const onRemoveFamily = async (otherId: string) => {
    if (!gymId || !member) return;
    try {
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      const otherRef = doc(db, "gyms", gymId, "members", otherId);
      await updateDoc(memberRef, { familyMemberIds: arrayRemove(otherId) });
      await updateDoc(otherRef, { familyMemberIds: arrayRemove(member.memberId) });
      setFamilyMemberIds(prev => prev.filter(id => id !== otherId));
      toast({ title: "Family Removed", description: "Connection broken." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to remove connection.", variant: "destructive" });
    }
  };

  const handleUpdate = async () => {
    const newEndDate = getNewEndDate();
    if (!newEndDate || !gymId) return;

    if (trainingType === "personal") {
      if (!ptGymFee) {
        toast({ title: "Missing Fields", description: "Base Gym Fee is required for Personal Training.", variant: "destructive" });
        return;
      }
      
      const fee = calculatedFinalFee;
      const months = selectedMonths || 1;
      const monthlyFee = fee / months;
      if (monthlyFee <= (Number(ptGymFee) * 2)) {
        toast({ 
          title: "Invalid Fee", 
          description: `Total Monthly PT fee (₹${monthlyFee.toFixed(0)}) must be strictly greater than double of Base Gym Fees (₹${Number(ptGymFee) * 2}).`, 
          variant: "destructive" 
        });
        return;
      }
    }

    const totalSplitAmount = renewalPaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    if (totalSplitAmount !== Number(renewalFee)) {
      toast({ title: "Payment Mismatch", description: `Split amounts (₹${totalSplitAmount}) must sum up to Paid Today (₹${renewalFee}).`, variant: "destructive" });
      return;
    }

    const sumInstallments = installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    if (Number(renewalFee) + sumInstallments !== calculatedFinalFee) {
      toast({ title: "Balance Mismatch", description: `Paid Today + Installments must perfectly equal the Payable Amount (₹${calculatedFinalFee}).`, variant: "destructive" });
      return;
    }

    let newPlanType = "custom";
    if (selectedMonths !== null) {
      if (selectedMonths === 1) newPlanType = "monthly";
      else if (selectedMonths === 3) newPlanType = "quarterly";
      else if (selectedMonths === 6) newPlanType = "half-yearly";
      else if (selectedMonths === 12) newPlanType = "yearly";
      else newPlanType = `${selectedMonths} months`;
    } else if (customDate) {
      const date1 = new Date(renewStartDate);
      const date2 = new Date(newEndDate);
      const diffTime = date2.getTime() - date1.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const months = Math.round(diffDays / 30);
      newPlanType = `custom (${months > 0 ? months : 0} Month${months !== 1 ? 's' : ''})`;
    }

    // Current plan as a record (to ensure we have it in history if missing)
    const currentPlanRecord = {
      planType: member.membershipType || "unknown",
      startDate: member.membershipStartDate,
      endDate: member.membershipEndDate,
      amountPaid: member.feesPaid || 0,
      trainingType: member.trainingType || "general",
      personalTrainerId: member.personalTrainerId || null,
      withGst: !!(member as any).withGst || false, // Fallback for older records
      paymentSplits: member.paymentSplits || [],
    };

    const newStartStr = formatDateOnly(renewStartDate);
    
    // New upcoming plan record
    const newPlanRecord = {
      planType: newPlanType,
      startDate: newStartStr,
      endDate: newEndDate,
      amountPaid: Number(renewalFee) || 0,
      trainingType: trainingType,
      personalTrainerId: trainingType === "personal" ? personalTrainerId : null,
      withGst: withGst,
      offerType: offerType,
      offerRemark: offerRemark,
      discountValue: discountValue,
      discountType: discountType,
      basePrice: Number(basePrice) || 0,
      ptGymFee: trainingType === "personal" ? Number(ptGymFee) : 0,
      paymentSplits: renewalPaymentSplits,
      installments: installments,
    };

    setIsUpdating(true);
    try {
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      
      // If no history exists, start with the current plan. Otherwise just append the new one.
      // We check if the last plan in history is the same as the current one to avoid duplicates.
      const history = member.planHistory || [];
      const isCurrentInHistory = history.some(p => p.startDate === member.membershipStartDate && p.endDate === member.membershipEndDate);
      
      const updatedHistory = isCurrentInHistory 
        ? [...history, newPlanRecord]
        : [...history, currentPlanRecord, newPlanRecord];

      await updateDoc(memberRef, {
        membershipType: newPlanType,
        membershipStartDate: newStartStr,
        membershipEndDate: newEndDate,
        // feesPaid now represents ONLY the current plan's fee
        feesPaid: Number(renewalFee) || 0,
        planHistory: updatedHistory,
        trainingType: trainingType,
        personalTrainerId: trainingType === "personal" ? personalTrainerId : (null as any),
        paymentSplits: renewalPaymentSplits,
        offerType: offerType,
        offerRemark: offerRemark,
        discountValue: discountValue,
        discountType: discountType,
        basePrice: Number(basePrice) || 0,
        ptGymFee: trainingType === "personal" ? Number(ptGymFee) : 0,
        withGst: withGst,
        familyMemberIds: familyMemberIds,
      });

      // Special handling: If converting from a trial for the first time, send registration confirmation
      if (member.membershipType === "trial") {
        const gymName = activeGym?.name || gymId;
        const memberDetailsForEmail: Partial<Member> = {
          ...member,
          membershipType: newPlanType as any,
          membershipStartDate: newStartStr,
          feesPaid: Number(renewalFee) || 0,
          paymentOption: "cash", // Default or we could use a state if we add one
          trainingType: trainingType,
          personalTrainerId: trainingType === "personal" ? personalTrainerId : undefined,
          offerType: offerType,
          offerRemark: offerRemark,
        };

        // Send Email
        if (member.email) {
          sendMemberConfirmationEmail(
            member.email,
            member.fullName,
            gymName,
            memberDetailsForEmail as any,
            newEndDate
          ).catch(err => console.error("Conversion email failed:", err));
        }

        // Send WhatsApp
        if (member.phone) {
          sendWhatsAppConfirmation(
            member.phone,
            member.fullName,
            gymName,
            memberDetailsForEmail as any,
            newEndDate,
            renewalPaymentSplits as any
          ).catch(err => console.error("Conversion WhatsApp failed:", err));
        }
      }

      if (Number(renewalFee) > 0) {
        const sharedInvoiceId = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
        for (const split of renewalPaymentSplits) {
          if (Number(split.amount) > 0) {
            await addDoc(collection(db, "gyms", gymId, "payments"), {
              memberId: member.memberId,
              amount: Number(split.amount),
              date: today.toISOString(),
              type: "renewal_fee",
              durationMonths: selectedMonths || null,
              invoiceId: sharedInvoiceId,
              planType: newPlanType,
              startDate: newStartStr,
              endDate: newEndDate,
              withGst: withGst,
              trainingType: trainingType,
              personalTrainerId: trainingType === "personal" ? personalTrainerId : (null as any),
              receivedBy: split.receivedBy,
              paymentMode: split.paymentMode || "cash",
            });
          }
        }
      }

      // Notify trainer if personal training was selected
      if (trainingType === "personal" && personalTrainerId) {
        const selectedTrainer = staff.find(s => s.staffId === personalTrainerId);
        // Only notify if this is a new trainer OR trainer changed
        const trainerChanged = personalTrainerId !== (member.personalTrainerId || "");
        const trainingTypeChanged = trainingType !== (member.trainingType || "general");
        
        if (selectedTrainer && selectedTrainer.email && (trainerChanged || trainingTypeChanged)) {
          try {
            const fee = Number(renewalFee) || 0;
            const months = selectedMonths || 1;
            const monthlyFee = fee / months;
            const gstDeduction = withGst ? (monthlyFee * 0.05) : 0;
            const baseGymFee = Number(ptGymFee) || 2000;
            const earnings = (monthlyFee - baseGymFee - gstDeduction) * 0.5;
            
            await fetch("/api/notify-trainer", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                gymId,
                trainerEmail: selectedTrainer.email,
                trainerName: selectedTrainer.fullName,
                trainerPhone: selectedTrainer.phone,
                memberName: member.fullName,
                earnings: earnings > 0 ? earnings : 0,
                startDate: newStartStr,
                endDate: newEndDate
              })
            });
          } catch (err) {
            console.error("Failed to notify trainer:", err);
          }
        }
      }

      toast({
        title: "Renewed",
        description: `Membership renewed until ${format(new Date(newEndDate), "PP")}`,
        action: (member.membershipType === "trial" || (member.planHistory || []).filter(p => p.planType !== 'trial').length === 0) ? (
          <ToastAction 
            altText="Open WhatsApp" 
            onClick={async () => {
              try {
                const res = await getRegistrationWhatsAppTextAction(member.memberId, gymId);
                if (res.success && res.text) {
                  const encodedMessage = encodeURIComponent(res.text);
                  const whatsappUrl = `https://wa.me/91${res.phone || member.phone}?text=${encodedMessage}`;
                  window.open(whatsappUrl, "_blank");
                }
              } catch (err) {
                console.error("Failed to open WhatsApp from toast:", err);
              }
            }}
          >
            Open WhatsApp
          </ToastAction>
        ) : undefined
      });
      
      handleOpenChange(false);
      onUpdate?.();
    } catch (err) {
      console.error("Renew error:", err);
      toast({ title: "Error", description: "Failed to renew membership.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const newEndDate = getNewEndDate();

  const TriggerBtn = triggerElement || (
    <Button variant="ghost" size="icon" className="h-8 w-8 text-[#8888A0] hover:text-white hover:bg-white/[0.04]">
      <RefreshCw className="h-4 w-4" />
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={TriggerBtn as any} />
      <DialogContent 
        className="w-[95vw] sm:max-w-2xl bg-[#1A1A2E] border-white/[0.08] text-white shadow-2xl p-4 sm:p-5 max-h-[85vh] overflow-y-auto custom-scrollbar z-[100]" 
        showCloseButton={false}
      >
        <div className="space-y-4">
          <p className="text-sm font-bold text-white tracking-wide uppercase">Renewal Settings</p>
          <div className="grid grid-cols-2 gap-2">
            {RENEWAL_OPTIONS.map((opt) => (
              <Button
                key={opt.months}
                variant={selectedMonths === opt.months && !customDate ? "default" : "outline"}
                size="sm"
                className={`text-xs h-9 transition-all ${
                  selectedMonths === opt.months && !customDate 
                  ? 'bg-[#B6916D] hover:bg-[#B6916D]/90 text-white border-transparent shadow-lg shadow-[#B6916D]/20' 
                  : 'bg-white/[0.02] border-white/[0.08] text-[#8888A0] hover:text-white hover:bg-white/[0.04]'
                }`}
                onClick={() => {
                  setSelectedMonths(opt.months);
                  setCustomDate("");
                }}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Custom Start Date</Label>
              <Input
                type="date"
                value={customStartDate}
                onChange={(e) => {
                  setCustomStartDate(e.target.value);
                  // If a month preset is active, recalculate end date from new start
                }}
                className="h-10 text-sm bg-white/[0.02] border-white/[0.08] text-white focus:border-[#B6916D]/50"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Custom End Date</Label>
              <Input
                type="date"
                value={customDate}
                min={customStartDate || today.toISOString().split("T")[0]}
                onChange={(e) => {
                  setCustomDate(e.target.value);
                  setSelectedMonths(null);
                }}
                className="h-10 text-sm bg-white/[0.02] border-white/[0.08] text-white focus:border-[#B6916D]/50"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Training Type</Label>
            <Select value={trainingType} onValueChange={(v: any) => {
              setTrainingType(v);
              if (v === "general") setPersonalTrainerId("");
            }}>
              <SelectTrigger className="h-9 bg-white/[0.02] border-white/[0.08] text-white text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                <SelectItem value="general">General Training</SelectItem>
                <SelectItem value="personal">Personal Training</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {trainingType === "personal" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Select Trainer</Label>
                <Select value={personalTrainerId} onValueChange={(v: any) => setPersonalTrainerId(v)}>
                  <SelectTrigger className="h-9 bg-white/[0.02] border-white/[0.08] text-white text-xs">
                    <SelectValue placeholder="Choose Trainer..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                    {staff.map(t => (
                      <SelectItem key={t.staffId} value={t.staffId}>{t.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Base Gym Fee (per month)</Label>
                <Input
                  type="number"
                  value={ptGymFee}
                  placeholder="e.g. 2000"
                  onChange={(e) => setPtGymFee(e.target.value)}
                  className="h-9 text-xs bg-white/[0.02] border-white/[0.08] text-white focus:border-[#B6916D]/50"
                />
                <p className="text-[10px] text-[#8888A0] italic">This amount is deducted from PT fee for gym share.</p>
              </div>
            </>
          )}

          <div className="space-y-4 pt-1 border-t border-white/[0.04]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Standard Fee (Base Price) (₹) <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={basePrice}
                  placeholder="e.g. 2200"
                  onChange={(e) => setBasePrice(e.target.value)}
                  className="h-9 text-xs bg-white/[0.02] border-white/[0.08] text-white focus:border-[#B6916D]/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Offer Type</Label>
                <Select value={offerType} onValueChange={(v) => setOfferType(v || "")}>
                  <SelectTrigger className="h-9 bg-white/[0.02] border-white/[0.08] text-white text-xs">
                    <SelectValue placeholder="No Offer" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                    <SelectItem value="">No Offer</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Couple">Couple</SelectItem>
                    <SelectItem value="Combo">Combo</SelectItem>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {offerType && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Discount Type</Label>
                    <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                      <SelectTrigger className="h-9 bg-white/[0.02] border-white/[0.08] text-white text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                        <SelectItem value="amount">Fixed Amount (₹)</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Discount Value</Label>
                    <Input
                      type="number"
                      placeholder={discountType === "percentage" ? "e.g. 10" : "e.g. 500"}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      className="h-9 text-xs bg-white/[0.02] border-white/[0.08] text-white focus:border-[#B6916D]/50"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Offer Remark</Label>
                    <textarea
                      placeholder="e.g. Student discount applied"
                      value={offerRemark}
                      onChange={(e) => setOfferRemark(e.target.value)}
                      className="w-full min-h-[60px] p-2 text-xs bg-white/[0.02] border border-white/[0.08] text-white focus:border-[#B6916D]/50 rounded-md focus:outline-none focus:ring-1 focus:ring-[#B6916D]/50"
                    />
                  </div>
                </>
              )}
            </div>

            {offerType && (
              <div className="space-y-1 px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-md my-2">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Standard Fee:</span>
                  <span className="text-white font-medium">₹{(Number(basePrice) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Discount Amount:</span>
                  <span className="text-red-400 font-medium">
                    -₹{(discountType === "percentage" 
                      ? Math.round((Number(basePrice) * Number(discountValue)) / 100)
                      : Number(discountValue) || 0
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
              <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider flex items-center gap-1">
                Paid Today / Upfront (₹) <span className="text-red-500">*</span>
              </Label>
              <Input
                type="number"
                value={renewalFee}
                min="0"
                placeholder="e.g. 1500"
                required
                onChange={(e) => setRenewalFee(e.target.value)}
                className="h-9 text-sm bg-[#B6916D]/10 border-[#B6916D]/30 text-white font-bold focus:border-[#B6916D]/50"
              />
            </div>

            <div className="pt-1">
              <PaymentSplitter 
                recipients={activeGym?.paymentRecipients || []}
                initialTotal={Number(renewalFee) || 0}
                initialSplits={renewalPaymentSplits}
                onChange={setRenewalPaymentSplits}
              />
            </div>

            <div className="pt-2">
              <InstallmentManager 
                installments={installments}
                onChange={setInstallments}
                payableAmount={calculatedFinalFee}
                paidAmount={Number(renewalFee) || 0}
              />
            </div>
          </div>

          <div className="space-y-4 pt-1 border-t border-white/[0.04]">
            {gymId && (
              <FamilyManager 
                currentFamilyIds={familyMemberIds}
                onAdd={onAddFamily}
                onRemove={onRemoveFamily}
                gymId={gymId}
                excludeMemberId={member.memberId}
              />
            )}
          </div>

          <div className="flex flex-col gap-1 py-1">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                id={`renewWithGst-${member.memberId}`} 
                checked={withGst} 
                onChange={(e) => setWithGst(e.target.checked)}
                disabled={activeGym?.gstStatus !== 'validated'}
                className="w-4 h-4 rounded border-white/[0.08] bg-white/[0.04] text-[#B6916D] focus:ring-[#B6916D] disabled:opacity-50"
              />
              <Label htmlFor={`renewWithGst-${member.memberId}`} className={`text-xs ${activeGym?.gstStatus !== 'validated' ? 'text-[#8888A0]/50' : 'text-[#8888A0]'} cursor-pointer`}>Generate GST Invoice</Label>
            </div>
            {activeGym?.gstStatus !== 'validated' && (
              <p className="text-[10px] text-amber-500/80 ml-6 italic">
                GST verification required in Settings.
              </p>
            )}
          </div>
          {newEndDate && (
            <div className="p-3 bg-[#B6916D]/5 rounded-lg border border-[#B6916D]/10">
              <p className="text-[11px] text-[#8888A0] uppercase font-bold tracking-tight mb-0.5">New Membership Period</p>
              <p className="text-sm font-bold text-white">
                {format(renewStartDate, "PP")} → {format(new Date(newEndDate), "PP")}
              </p>
            </div>
          )}
          <Button
            className="w-full h-10 bg-[#B6916D] hover:bg-[#B6916D]/90 text-white font-bold rounded-lg shadow-lg shadow-[#B6916D]/20 mt-2"
            disabled={
              !newEndDate || 
              isUpdating || 
              (trainingType === "personal" && (!personalTrainerId || !ptGymFee)) || 
              !renewalFee ||
              (renewalPaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) !== (Number(renewalFee) || 0)) ||
              renewalPaymentSplits.some(s => !s.receivedBy) ||
              ((Number(renewalFee) || 0) + installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) !== calculatedFinalFee)
            }
            onClick={handleUpdate}
          >
            {isUpdating ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating...</>
            ) : (
              "Confirm Renewal"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
