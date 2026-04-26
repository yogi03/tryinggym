"use client";

import { useState } from "react";
import { Member, Staff, Installment } from "@/types";
import { format, isAfter, isBefore, startOfDay, addDays } from "date-fns";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, collection, addDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, IndianRupee, Loader2, Calendar, Phone, CheckCircle2, ArchiveX } from "lucide-react";
import InstallmentManager from "../shared/InstallmentManager";

interface PendingInstallmentsProps {
  members: Member[];
  staff: Staff[];
}

interface InstallmentWithContext {
  member: Member;
  planIndex: number;
  plan: NonNullable<Member['planHistory']>[0];
  installment: Installment;
  isOverdue: boolean;
  isDueToday: boolean;
}

export default function PendingInstallments({ members, staff }: PendingInstallmentsProps) {
  const { adminData, frontDeskData, activeGym } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const { toast } = useToast();

  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [selectedInst, setSelectedInst] = useState<InstallmentWithContext | null>(null);
  const [payMode, setPayMode] = useState("cash");
  const [receivedBy, setReceivedBy] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [popupInstallments, setPopupInstallments] = useState<Installment[]>([]);
  const [popupOriginalUpfront, setPopupOriginalUpfront] = useState(0);
  const [popupPayableAmount, setPopupPayableAmount] = useState(0);

  const today = startOfDay(new Date());
  const fiveDaysFromNow = addDays(today, 5);

  const displayInstallments: InstallmentWithContext[] = [];

  members.forEach((m) => {
    if (m.isArchived) return;
    
    // We also check top-level installments if they exist, but we prioritized planHistory
    if (m.planHistory && m.planHistory.length > 0) {
      m.planHistory.forEach((plan, planIndex) => {
        if (plan.installments && plan.installments.length > 0) {
          plan.installments.forEach((inst) => {
            if (inst.status === "pending") {
              const dueDate = startOfDay(new Date(inst.dueDate));
              
              if (isBefore(dueDate, fiveDaysFromNow) || dueDate.getTime() === fiveDaysFromNow.getTime()) {
                displayInstallments.push({
                  member: m,
                  planIndex,
                  plan,
                  installment: inst,
                  isOverdue: isBefore(dueDate, today),
                  isDueToday: dueDate.getTime() === today.getTime()
                });
              }
            }
          });
        }
      });
    }
  });

  // Sort by due date (oldest/most overdue first)
  displayInstallments.sort((a, b) => new Date(a.installment.dueDate).getTime() - new Date(b.installment.dueDate).getTime());

  const handleOpenPay = (instData: InstallmentWithContext) => {
    setSelectedInst(instData);
    setPayMode("cash");
    setReceivedBy(activeGym?.paymentRecipients?.[0] || "");
    
    // Initialize InstallmentManager states
    const planInstallments = instData.plan.installments || [];
    setPopupInstallments(planInstallments);
    
    const paidInstSum = planInstallments.filter(i => i.status === "paid").reduce((sum, i) => sum + i.amount, 0);
    const currentAmountPaid = instData.plan.amountPaid || 0;
    const upfront = currentAmountPaid - paidInstSum;
    setPopupOriginalUpfront(upfront);
    
    const pendingInstSum = planInstallments.filter(i => i.status === "pending").reduce((sum, i) => sum + i.amount, 0);
    setPopupPayableAmount(currentAmountPaid + pendingInstSum);

    setPayDialogOpen(true);
  };

  const handleConfirmPay = async () => {
    if (!selectedInst || !gymId || !receivedBy) {
      toast({ title: "Incomplete details", description: "Please select a payment recipient.", variant: "destructive" });
      return;
    }

    const sumInsts = popupInstallments.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
    if (popupOriginalUpfront + sumInsts !== popupPayableAmount) {
      toast({ title: "Balance Mismatch", description: "Installments and Upfront payment must perfectly equal the Payable Amount.", variant: "destructive" });
      return;
    }

    const { member, planIndex, plan } = selectedInst;
    const targetInst = popupInstallments.find(i => i.id === selectedInst.installment.id);
    
    if (!targetInst) {
      toast({ title: "Installment Missing", description: "The originally selected installment to pay was removed or altered.", variant: "destructive" });
      return;
    }

    setIsProcessing(true);
    try {
      const invId = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;

      // Create Payment Document
      await addDoc(collection(db, "gyms", gymId, "payments"), {
        memberId: member.memberId,
        amount: targetInst.amount,
        date: new Date().toISOString(),
        paymentMode: payMode,
        receivedBy: receivedBy,
        type: "installment_fee",
        invoiceId: invId,
      });

      // Update Member Document
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      const nextHistory = [...(member.planHistory || [])];
      
      const targetPlan = { ...nextHistory[planIndex] };
      const updatedInstallments = popupInstallments.map(i => 
        i.id === targetInst.id 
          ? { ...i, status: "paid" as const, paidDate: new Date().toISOString(), invoiceId: invId } 
          : i
      );
      
      targetPlan.installments = updatedInstallments;
      targetPlan.amountPaid = popupOriginalUpfront + updatedInstallments.filter(i => i.status === "paid").reduce((sum, i) => sum + Number(i.amount), 0);
      nextHistory[planIndex] = targetPlan;

      // Update total feesPaid for member if it's the current plan
      let totalFeesPaid = member.feesPaid || 0;
      // If the plan is the current active plan, update top level feesPaid
      if (plan.startDate === member.membershipStartDate && plan.endDate === member.membershipEndDate) {
        totalFeesPaid = targetPlan.amountPaid;
      }

      await updateDoc(memberRef, { 
        planHistory: nextHistory,
        ...(plan.startDate === member.membershipStartDate && plan.endDate === member.membershipEndDate ? { feesPaid: totalFeesPaid } : {})
      });

      toast({ title: "Payment Recorded", description: `Installment of ₹${targetInst.amount} marked as paid.` });
      setPayDialogOpen(false);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to process payment.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleArchiveInst = async (instData: InstallmentWithContext) => {
    if (!gymId) return;
    if (!confirm(`Are you sure you want to archive this installment of ₹${instData.installment.amount}?`)) return;

    try {
      const { member, planIndex, installment } = instData;
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      const nextHistory = [...(member.planHistory || [])];
      
      const targetPlan = { ...nextHistory[planIndex] };
      targetPlan.installments = targetPlan.installments?.map(i => 
        i.id === installment.id ? { ...i, status: "archived" as const } : i
      );
      nextHistory[planIndex] = targetPlan;

      await updateDoc(memberRef, { planHistory: nextHistory });
      toast({ title: "Archived", description: "Installment scheme moved to archive." });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to archive installment.", variant: "destructive" });
    }
  };

  if (displayInstallments.length === 0) return null;

  return (
    <div className="bg-[#131313] border border-white/[0.08] rounded-2xl overflow-hidden mt-6">
      <div className="p-4 sm:p-5 border-b border-white/[0.08] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
            <IndianRupee className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-white">Pending Installments</h2>
            <p className="text-xs text-[#8888A0]">Due today, overdue, or within 5 days</p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-white/[0.04]">
        {displayInstallments.map((item, idx) => {
          const { member, installment, isOverdue, isDueToday } = item;
          
          return (
            <div key={`${installment.id}-${idx}`} className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${isOverdue ? 'bg-red-500' : isDueToday ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">{member.fullName}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      isOverdue ? "bg-red-500/10 text-red-500" : 
                      isDueToday ? "bg-amber-500/10 text-amber-500" : 
                      "bg-emerald-500/10 text-emerald-500"
                    }`}>
                      {isOverdue ? `Overdue by ${Math.floor((today.getTime() - new Date(installment.dueDate).getTime()) / (1000*60*60*24))} days` : 
                       isDueToday ? "Due Today" : 
                       `Due in ${Math.floor((new Date(installment.dueDate).getTime() - today.getTime()) / (1000*60*60*24))} days`}
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#8888A0]">
                    <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {member.phone}</span>
                    <span className="flex items-center gap-1.5"><Calendar className="h-3 w-3" /> Due on {format(new Date(installment.dueDate), "MMM d, yyyy")}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center flex-wrap gap-3 sm:ml-auto">
                <div className="text-left sm:text-right w-full sm:w-auto mb-2 sm:mb-0">
                  <p className="text-[10px] text-[#8888A0] uppercase font-bold tracking-wider mb-0.5">Installment Amount</p>
                  <p className="text-lg font-bold text-orange-400">₹{installment.amount.toLocaleString()}</p>
                </div>
                
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Button 
                    size="sm"
                    className="flex-1 sm:flex-none gap-2 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white"
                    onClick={() => handleOpenPay(item)}
                  >
                    <CheckCircle2 className="h-4 w-4" /> Pay Now
                  </Button>
                  <Button 
                    size="icon"
                    variant="ghost" 
                    title="Archive Installment"
                    className="h-9 w-9 text-[#8888A0] hover:text-amber-400 hover:bg-amber-400/10 shrink-0"
                    onClick={() => handleArchiveInst(item)}
                  >
                    <ArchiveX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent className="sm:max-w-xl bg-[#0F0F1A] border-white/[0.08] text-white my-4 max-h-[95vh] overflow-y-auto custom-scrollbar">
          <DialogHeader>
            <DialogTitle>Process Installment Payment</DialogTitle>
            <DialogDescription className="text-[#8888A0]">
              Confirm receipt of ₹{popupInstallments.find(i => i.id === selectedInst?.installment.id)?.amount || 0} from {selectedInst?.member.fullName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs text-[#8888A0]">Payment Mode</label>
              <Select value={payMode} onValueChange={setPayMode}>
                <SelectTrigger className="w-full bg-[#131313] border-white/[0.08]">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card / POS</SelectItem>
                  <SelectItem value="upi">UPI / Online</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-xs text-[#8888A0]">Received By (Staff) <span className="text-red-500">*</span></label>
              <Select value={receivedBy} onValueChange={setReceivedBy}>
                <SelectTrigger className="w-full bg-[#131313] border-white/[0.08]">
                  <SelectValue placeholder="Select who received payment" />
                </SelectTrigger>
                <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                  {activeGym?.paymentRecipients?.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="pt-2 pb-2">
              <InstallmentManager
                installments={popupInstallments}
                onChange={setPopupInstallments}
                payableAmount={popupPayableAmount}
                paidAmount={popupOriginalUpfront}
                highlightId={selectedInst?.installment.id}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayDialogOpen(false)} disabled={isProcessing} className="bg-transparent border-white/[0.08] text-[#8888A0]">
              Cancel
            </Button>
            <Button onClick={handleConfirmPay} disabled={isProcessing || !receivedBy} className="bg-emerald-500 hover:bg-emerald-600 text-white min-w-[100px]">
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
