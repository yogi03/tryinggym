"use client";

import { useState } from "react";
import { Ticket, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/auth-context";
import PaymentSplitter, { SplitPayment } from "../shared/PaymentSplitter";

interface TrialPassDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DEFAULT_TRIAL_FORM = {
  fullName: "",
  email: "",
  phone: "",
  gender: "" as string,
  trialDate: new Date().toISOString().split("T")[0],
  feesPaid: "",
};

export default function TrialPassDialog({ open, onOpenChange, onSuccess }: TrialPassDialogProps) {
  const { adminData, frontDeskData } = useAuth();
  const { toast } = useToast();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [form, setForm] = useState({ ...DEFAULT_TRIAL_FORM });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<SplitPayment[]>([]);
  const { activeGym } = useAuth();

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setForm({ ...DEFAULT_TRIAL_FORM, trialDate: new Date().toISOString().split("T")[0] });
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isSubmitting) {
      onOpenChange(isOpen);
      if (!isOpen) resetForm();
    }
  };

  const handleSubmit = async () => {
    if (!gymId) return;

    // Validation
    if (!form.fullName.trim()) {
      toast({ title: "Missing Field", description: "Full Name is required.", variant: "destructive" });
      return;
    }
    if (!form.phone || !/^[6-9]\d{9}$/.test(form.phone)) {
      toast({ title: "Invalid Phone", description: "Phone must be 10 digits starting with 6, 7, 8, or 9.", variant: "destructive" });
      return;
    }
    if (!form.gender) {
      toast({ title: "Missing Field", description: "Gender is required.", variant: "destructive" });
      return;
    }

    if (!form.trialDate) {
      toast({ title: "Missing Field", description: "Trial Date is required.", variant: "destructive" });
      return;
    }
    if (!form.feesPaid) {
      toast({ title: "Missing Field", description: "Fees Paid is required.", variant: "destructive" });
      return;
    }

    const totalSplitAmount = paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    if (totalSplitAmount !== Number(form.feesPaid)) {
      toast({ title: "Payment Mismatch", description: `Split amounts (₹${totalSplitAmount}) must sum up to Total Fees Paid (₹${form.feesPaid}).`, variant: "destructive" });
      return;
    }

    if (paymentSplits.some(s => !s.receivedBy)) {
      toast({ title: "Recipient Missing", description: "Please select a recipient for all partial payments.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    const { dismiss } = toast({ title: "Registering...", description: "Processing trial pass registration.", duration: Infinity });

    try {
      const { registerTrialMember } = await import("@/app/trial/actions");
      const result = await registerTrialMember(gymId, {
        fullName: form.fullName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || "",
        gender: form.gender,
        trialDate: form.trialDate,
        feesPaid: Number(form.feesPaid) || 0,
        paymentSplits: paymentSplits,
      });

      dismiss();

      if (!result.success) {
        toast({ title: "Error", description: result.error || "Failed to register trial member.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      toast({ title: "Trial Pass Registered!", description: `${form.fullName} has been registered for a trial on ${new Date(form.trialDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}.` });
      handleOpenChange(false);
      onSuccess?.();
    } catch (error) {
      dismiss();
      console.error("Error registering trial pass:", error);
      toast({ title: "Error", description: "Failed to register trial pass. Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="h-5 w-5 text-[#B6916D]" />Trial Pass Registration
          </DialogTitle>
          <DialogDescription className="text-[#8888A0]">
            Register a 1-day trial pass for a new member. Confirmation email &amp; WhatsApp will be sent automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label className="text-[#8888A0]">Full Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="e.g. Virat Kohli"
              value={form.fullName}
              onChange={(e) => handleChange("fullName", e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label className="text-[#8888A0]">Email</Label>
            <Input
              type="email"
              placeholder="e.g. virat@email.com (optional)"
              value={form.email}
              onChange={(e) => handleChange("email", e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <Label className="text-[#8888A0]">Mobile Number <span className="text-destructive">*</span></Label>
            <Input
              type="tel"
              maxLength={10}
              placeholder="10-digit mobile number"
              value={form.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
            />
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <Label className="text-[#8888A0]">Gender <span className="text-destructive">*</span></Label>
            <Select value={form.gender || "Select Gender"} onValueChange={(v) => handleChange("gender", (v === "placeholder" || !v) ? "" : v)}>
              <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                <SelectItem value="placeholder" disabled>Select Gender</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
              </SelectContent>
            </Select>
          </div>



          <div className="space-y-1.5">
            <Label className="text-[#8888A0]">Total Fees Paid (₹) <span className="text-destructive">*</span></Label>
            <Input
              type="number"
              min="0"
              placeholder="e.g. 100"
              value={form.feesPaid}
              onChange={(e) => handleChange("feesPaid", e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
              required
            />
          </div>

          <div className="pt-2">
            <PaymentSplitter 
              recipients={activeGym?.paymentRecipients || []}
              initialTotal={Number(form.feesPaid) || 0}
              onChange={setPaymentSplits}
            />
          </div>

          {/* Trial Date */}
          <div className="space-y-1.5">
            <Label className="text-[#8888A0]">Trial Date <span className="text-destructive">*</span></Label>
            <Input
              type="date"
              value={form.trialDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => handleChange("trialDate", e.target.value)}
              className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
            />
          </div>

          {/* Summary */}
          {form.fullName && form.trialDate && (
            <div className="p-3 bg-[#B6916D]/5 rounded-lg border border-[#B6916D]/10">
              <p className="text-[11px] text-[#8888A0] uppercase font-bold tracking-tight mb-0.5">Trial Summary</p>
              <p className="text-sm font-bold text-white">
                {form.fullName} — {new Date(form.trialDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })} (1 Day)
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
            className="w-full sm:w-auto bg-transparent border-white/[0.08] text-[#8888A0] hover:bg-white/[0.04]"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              isSubmitting || 
              (paymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) !== (Number(form.feesPaid) || 0)) ||
              paymentSplits.some(s => !s.receivedBy)
            }
            className="w-full sm:w-auto gap-2 bg-[#B6916D] hover:bg-[#B6916D]/90 text-white"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />}
            {isSubmitting ? "Registering..." : "Register Trial Pass"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
