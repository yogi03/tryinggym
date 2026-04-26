"use client";

import { useRef, useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Member, Installment } from "@/types";
import { format, addDays } from "date-fns";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw, Loader2, Trash2, IndianRupee, Check, ChevronLeft, ChevronRight, CalendarPlus, ArrowUpCircle, Download, X, User, Zap } from "lucide-react";
import RenewMembershipPopover from "./RenewMembershipPopover";
import PaymentSplitter, { SplitPayment } from "./shared/PaymentSplitter";
import InstallmentManager from "./shared/InstallmentManager";
import { addExactMonths, formatDateOnly } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { archiveMember } from "@/lib/firebase/archive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MemberTableProps {
  members: Member[];
  title: string;
  showDoneButton?: boolean;
  hideSelection?: boolean;
}

const RENEWAL_OPTIONS = [
  { label: "Monthly (1 Month)", months: 1 },
  { label: "Quarterly (3 Months)", months: 3 },
  { label: "Half-Yearly (6 Months)", months: 6 },
  { label: "Yearly (12 Months)", months: 12 },
];

function InlineEditCell({
  memberId,
  member,
  gymId,
  field,
  value,
  type = "text",
  placeholder = "—",
  prefix,
  disabled = false,
  onActive,
}: {
  memberId: string;
  member?: Member;
  gymId: string;
  field: string;
  value: string | number | undefined;
  type?: "text" | "number";
  placeholder?: string;
  prefix?: React.ReactNode;
  disabled?: boolean;
  onActive?: (state: boolean) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // We bubble the event via event listener on the element to avoid complex prop drilling if possible,
  // Or since I can modify the prop, let's use a standard onEditChange prop:
  // Using an effect to notify parent inside MemberTable mappings.


  const startEdit = () => {
    if (disabled) return;
    setDraft(String(value ?? ""));
    setEditing(true);
    onActive?.(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const save = async () => {
    const parsed = type === "number" ? parseFloat(draft) : draft.trim();
    if (parsed === value || (type === "number" && isNaN(parsed as number))) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const ref = doc(db, "gyms", gymId, "members", memberId);
      const finalValue = type === "number" ? (parsed || 0) : parsed;
      const updateData: Record<string, any> = { [field]: finalValue };

      if (field === "feesPaid") {
        if (member) {
          const updatedPlanHistory = [...(member.planHistory || [])];
          if (updatedPlanHistory.length > 0) {
            updatedPlanHistory[0] = {
              ...updatedPlanHistory[0],
              amountPaid: finalValue as number
            };
            updateData.planHistory = updatedPlanHistory;
          }
        }

        const difference = (finalValue as number) - (Number(value) || 0);
        if (difference !== 0) {
          await addDoc(collection(db, "gyms", gymId, "payments"), {
            memberId,
            amount: difference,
            date: new Date().toISOString(),
            type: "fee_update"
          });
        }
      }

      await updateDoc(ref, updateData);
    } catch {
      toast({ title: "Error", description: "Failed to save.", variant: "destructive" });
    } finally {
      setSaving(false);
      setEditing(false);
      onActive?.(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[80px]" onClick={(e) => e.stopPropagation()}>
        {prefix}
        <Input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              setEditing(false);
              onActive?.(false);
            }
          }}
          className="h-7 text-sm px-1 py-0 w-24"
          disabled={saving}
        />
        {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
    );
  }

  const display =
    type === "number"
      ? value !== undefined && value !== null && value !== ""
        ? <span className="flex items-center gap-0.5">{prefix}<span>{Number(value).toLocaleString()}</span></span>
        : <span className="text-muted-foreground italic text-xs">click to add</span>
      : value
        ? <span>{String(value)}</span>
        : <span className="text-muted-foreground">{placeholder}</span>;

  return (
    <button
      type="button"
      className={`text-left w-full ${disabled ? "cursor-default" : "cursor-pointer hover:bg-muted/50 transition-colors group rounded px-1 py-0.5"}`}
      title={disabled ? "" : "Click to edit"}
      onClick={(e) => {
        e.stopPropagation();
        startEdit();
      }}
    >
      <span className={disabled ? "" : "group-hover:underline decoration-dashed underline-offset-2"}>
        {display}
      </span>
    </button>
  );
}



export default function MemberTable({ members, title, showDoneButton, hideSelection }: MemberTableProps) {
  const router = useRouter();
  const { adminData, activeGym, frontDeskData, user } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  
  const [bulkExtendOpen, setBulkExtendOpen] = useState(false);
  const [extendDays, setExtendDays] = useState(0);
  const [isExtending, setIsExtending] = useState(false);

  const [bulkUpgradeOpen, setBulkUpgradeOpen] = useState(false);
  const [upgradePlan, setUpgradePlan] = useState("");
  const [isUpgrading, setIsUpgrading] = useState(false);
  
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // Done dialog state
  const [doneDialogOpen, setDoneDialogOpen] = useState(false);
  const [doneTargetMember, setDoneTargetMember] = useState<Member | null>(null);
  const [doneWithGst, setDoneWithGst] = useState(false);
  const [doneTrainingType, setDoneTrainingType] = useState<"general" | "personal">("general");
  const [donePersonalTrainerId, setDonePersonalTrainerId] = useState("");
  const [doneStaff, setDoneStaff] = useState<{staffId: string; fullName: string; email?: string; phone?: string}[]>([]);
  const [isConfirmingDone, setIsConfirmingDone] = useState(false);
  const [donePaymentSplits, setDonePaymentSplits] = useState<SplitPayment[]>([]);
  const [doneOfferType, setDoneOfferType] = useState("");
  const [doneOfferRemark, setDoneOfferRemark] = useState("");
  const [doneDiscountValue, setDoneDiscountValue] = useState("");
  const [doneDiscountType, setDoneDiscountType] = useState<"amount" | "percentage">("amount");
  const [doneBasePrice, setDoneBasePrice] = useState("");
  const [donePtGymFee, setDonePtGymFee] = useState("");
  const [doneFeesPaid, setDoneFeesPaid] = useState("");
  const [doneInstallments, setDoneInstallments] = useState<Installment[]>([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(members.length / itemsPerPage));
  
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  if (currentPage !== validPage && validPage > 0) setCurrentPage(validPage);

  const currentMembers = members.slice(
    (validPage - 1) * itemsPerPage,
    validPage * itemsPerPage
  );

  const allSelected = currentMembers.length > 0 && currentMembers.every((m) => selectedIds.has(m.memberId));
  const someSelected = selectedIds.size > 0;

  // Opens the Done dialog to ask for GST invoice + training type
  const handleDone = async (member: Member) => {
    if (!gymId) return;
    // Fetch trainers for the selector
    const { getDocs, query, collection: firestoreCollection, where } = await import("firebase/firestore");
    try {
      const snap = await getDocs(query(firestoreCollection(db, "gyms", gymId, "staff"), where("role", "==", "Trainer")));
      setDoneStaff(snap.docs.map(d => ({ staffId: d.id, ...(d.data() as any) })));
    } catch { /* ignore */ }
    setDoneTargetMember(member);
    setDoneWithGst(!!member.withGst);
    setDoneTrainingType(member.trainingType || "general");
    setDonePersonalTrainerId(member.personalTrainerId || "");
    
    // Pre-populate splits if they exist on the member object
    if (member.paymentSplits && member.paymentSplits.length > 0) {
      setDonePaymentSplits(member.paymentSplits);
    } else {
      setDonePaymentSplits([{ amount: member.feesPaid || 0, receivedBy: "" }]);
    }

    setDoneOfferType(member.offerType || "");
    setDoneOfferRemark(member.offerRemark || "");
    setDoneDiscountValue(member.discountValue || "");
    setDoneDiscountType(member.discountType || "amount");
    setDoneBasePrice(String(member.basePrice || member.feesPaid || ""));
    setDonePtGymFee(String(member.ptGymFee || ""));
    setDoneFeesPaid(String(member.feesPaid || ""));
    setDoneInstallments(member.installments || []);

    setDoneDialogOpen(true);
  };

  const doneFinalFee = (() => {
    const base = Number(doneBasePrice) || 0;
    const discValue = Number(doneDiscountValue) || 0;
    const hasOffer = !!doneOfferType;

    let finalFee = base;
    if (hasOffer) {
      if (doneDiscountType === "percentage") {
        finalFee = Math.max(0, Math.round(base - (base * discValue / 100)));
      } else {
        finalFee = Math.max(0, base - discValue);
      }
    }
    return finalFee;
  })();

  const confirmDone = async () => {
    if (!gymId || !doneTargetMember) return;
    setIsConfirmingDone(true);
    try {
      if (doneTrainingType === "personal") {
        if (!donePtGymFee) {
          toast({ title: "Missing Fields", description: "Base Gym Fee is required for Personal Training.", variant: "destructive" });
          setIsConfirmingDone(false);
          return;
        }

        let months = 1;
        if (doneTargetMember.membershipType === "monthly") months = 1;
        else if (doneTargetMember.membershipType === "quarterly") months = 3;
        else if (doneTargetMember.membershipType === "half-yearly") months = 6;
        else if (doneTargetMember.membershipType === "yearly") months = 12;

        const monthlyFee = doneFinalFee / months;
        if (monthlyFee <= (Number(donePtGymFee) * 2)) {
          toast({ 
            title: "Invalid Fee", 
            description: `Total Monthly PT fee (₹${monthlyFee.toFixed(0)}) must be strictly greater than double of Base Gym Fees (₹${Number(donePtGymFee) * 2}).`, 
            variant: "destructive" 
          });
          setIsConfirmingDone(false);
          return;
        }
      }

      const totalSplitAmount = donePaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      if (totalSplitAmount !== Number(doneFeesPaid)) {
        toast({ title: "Payment Mismatch", description: `Split amounts (₹${totalSplitAmount}) must sum up to Total Fees Paid (₹${doneFeesPaid}).`, variant: "destructive" });
        setIsConfirmingDone(false);
        return;
      }

      const sumInstallments = doneInstallments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
      if (Number(doneFeesPaid) + sumInstallments !== doneFinalFee) {
        toast({ title: "Balance Mismatch", description: `Paid Today + Installments must perfectly equal the Payable Amount (₹${doneFinalFee}).`, variant: "destructive" });
        setIsConfirmingDone(false);
        return;
      }

      const memberRef = doc(db, "gyms", gymId, "members", doneTargetMember.memberId);
      
      const updatedPlanHistory = [...(doneTargetMember.planHistory || [])];
      if (updatedPlanHistory.length > 0) {
        updatedPlanHistory[0] = {
          ...updatedPlanHistory[0],
          amountPaid: Number(doneFeesPaid) || 0,
          trainingType: doneTrainingType,
          personalTrainerId: doneTrainingType === "personal" ? donePersonalTrainerId : null,
          withGst: doneWithGst,
          offerType: doneOfferType,
          offerRemark: doneOfferRemark,
          discountValue: doneDiscountValue,
          discountType: doneDiscountType,
          basePrice: Number(doneBasePrice) || 0,
          ptGymFee: doneTrainingType === "personal" ? Number(donePtGymFee) : 0,
          installments: doneInstallments,
        };
      }

      await updateDoc(memberRef, {
        isAcknowledged: true,
        feesPaid: Number(doneFeesPaid) || 0,
        trainingType: doneTrainingType,
        personalTrainerId: doneTrainingType === "personal" ? donePersonalTrainerId : null,
        withGst: doneWithGst,
        offerType: doneOfferType,
        offerRemark: doneOfferRemark,
        discountValue: doneDiscountValue,
        discountType: doneDiscountType,
        basePrice: Number(doneBasePrice) || 0,
        ptGymFee: doneTrainingType === "personal" ? Number(donePtGymFee) : 0,
        paymentSplits: donePaymentSplits,
        planHistory: updatedPlanHistory,
        installments: doneInstallments,
      });

      // Update/Create payment records
      if ((Number(doneFeesPaid) || 0) > 0) {
        const { getDocs: gd, query: q, collection: col, where: w, deleteDoc: dd, addDoc: ad } = await import("firebase/firestore");
        
        const totalSplits = donePaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
        if (totalSplits !== (doneTargetMember.feesPaid || 0)) {
          toast({ title: "Payment Mismatch", description: `Split amounts (₹${totalSplits}) must sum up to Total Fees Paid (₹${doneTargetMember.feesPaid}).`, variant: "destructive" });
          setIsConfirmingDone(false);
          return;
        }

        if (donePaymentSplits.some(s => !s.receivedBy)) {
          toast({ title: "Recipient Missing", description: "Please select a recipient for all partial payments.", variant: "destructive" });
          setIsConfirmingDone(false);
          return;
        }

        // Delete any existing payments for this member to avoid duplicates
        const paySnap = await gd(q(col(db, "gyms", gymId, "payments"), w("memberId", "==", doneTargetMember.memberId)));
        await Promise.all(paySnap.docs.map(p => dd(p.ref)));

        // Create new split payments
        const sharedInvoiceId = `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
        for (const split of donePaymentSplits) {
          if (Number(split.amount) > 0) {
            await ad(col(db, "gyms", gymId, "payments"), {
              memberId: doneTargetMember.memberId,
              amount: Number(split.amount),
              date: new Date().toISOString(),
              type: "joining_fee",
              invoiceId: sharedInvoiceId,
              planType: doneTargetMember.membershipType,
              startDate: doneTargetMember.membershipStartDate,
              endDate: doneTargetMember.membershipEndDate,
              offerType: doneOfferType,
              offerRemark: doneOfferRemark,
              withGst: doneWithGst,
              receivedBy: split.receivedBy
            });
          }
        }
      }

      // Notify trainer if personal training
      if (doneTrainingType === "personal" && donePersonalTrainerId) {
        const trainer = doneStaff.find(s => s.staffId === donePersonalTrainerId);
        if (trainer && trainer.email) {
          const fee = doneTargetMember.feesPaid || 0;
          const gst = fee * 0.05;
          const basePrice = fee - gst;
          let months = 1;
          if (doneTargetMember.membershipType === "quarterly") months = 3;
          else if (doneTargetMember.membershipType === "half-yearly") months = 6;
          else if (doneTargetMember.membershipType === "yearly") months = 12;
          const earnings = ((basePrice / months) - (doneTargetMember.ptGymFee ?? activeGym?.ptGymFee ?? 2000)) * 0.5;
          fetch("/api/notify-trainer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gymId,
              trainerEmail: trainer.email,
              trainerName: trainer.fullName,
              trainerPhone: trainer.phone,
              memberName: doneTargetMember.fullName,
              earnings: earnings > 0 ? earnings : 0,
              startDate: doneTargetMember.membershipStartDate,
              endDate: doneTargetMember.membershipEndDate
            })
          }).catch(console.error);
        }
      }

      toast({ title: "Done", description: "Member acknowledged and moved from dashboard." });
      setDoneDialogOpen(false);
    } catch (err) {
      console.error("Error confirming done:", err);
      toast({ title: "Error", description: "Failed to acknowledge member.", variant: "destructive" });
    } finally {
      setIsConfirmingDone(false);
    }
  };

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      currentMembers.forEach(m => next.delete(m.memberId));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      currentMembers.forEach(m => next.add(m.memberId));
      setSelectedIds(next);
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!adminData || !user) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await Promise.all(ids.map((id) => archiveMember(adminData.gymId, id, user.uid)));
      toast({ title: "Deleted", description: `${ids.length} member(s) deleted successfully.`, toast: undefined });
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast({ title: "Error", description: "Failed to delete some members.", variant: "destructive", toast: undefined });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleExportSelected = () => {
    const ids = Array.from(selectedIds);
    const selectedMembers = members.filter(m => ids.includes(m.memberId));
    
    if (selectedMembers.length === 0) return;
    
    const exportData = selectedMembers.map(m => ({
      "Member ID": m.memberId,
      "Name": m.fullName,
      "Nickname": m.nickname || "",
      "Email": m.email,
      "Phone": m.phone,
      "Plan": m.membershipType,
      "Start Date": m.membershipStartDate ? new Date(m.membershipStartDate).toLocaleDateString() : "",
      "Renewal Date": m.membershipEndDate ? new Date(m.membershipEndDate).toLocaleDateString() : "",
      "Fees Paid": m.feesPaid || 0,
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Selected Members");
    XLSX.writeFile(wb, "GymManagr_Selected_Members.xlsx");
    toast({ title: "Exported", description: `Exported ${selectedMembers.length} members.` });
  };

  const handleBulkExtend = async () => {
    if (!adminData || extendDays <= 0) return;
    setIsExtending(true);
    try {
      const ids = Array.from(selectedIds);
      const selectedMembers = members.filter(m => ids.includes(m.memberId));

      await Promise.all(selectedMembers.map(async (m) => {
        const memberRef = doc(db, "gyms", adminData.gymId, "members", m.memberId);
        const newEndDateStr = addDays(new Date(m.membershipEndDate), extendDays).toISOString().split("T")[0];
        
        return updateDoc(memberRef, {
          membershipEndDate: newEndDateStr
        });
      }));

      toast({ title: "Success", description: `Added ${extendDays} days to ${ids.length} members.` });
      setSelectedIds(new Set());
      setExtendDays(0);
      setBulkExtendOpen(false);
    } catch (err) {
      console.error("Bulk extend error:", err);
      toast({ title: "Error", description: "Failed to extend memberships.", variant: "destructive" });
    } finally {
      setIsExtending(false);
    }
  };

  const handleBulkUpgrade = async () => {
    if (!adminData || !upgradePlan) return;
    setIsUpgrading(true);
    try {
      const ids = Array.from(selectedIds);
      const selectedMembers = members.filter(m => ids.includes(m.memberId));

      await Promise.all(selectedMembers.map(async (m) => {
        const memberRef = doc(db, "gyms", adminData.gymId, "members", m.memberId);
        
        let newEndDateStr = m.membershipEndDate;
        
        if (upgradePlan === "monthly") newEndDateStr = formatDateOnly(addExactMonths(m.membershipStartDate, 1));
        else if (upgradePlan === "quarterly") newEndDateStr = formatDateOnly(addExactMonths(m.membershipStartDate, 3));
        else if (upgradePlan === "half-yearly") newEndDateStr = formatDateOnly(addExactMonths(m.membershipStartDate, 6));
        else if (upgradePlan === "yearly") newEndDateStr = formatDateOnly(addExactMonths(m.membershipStartDate, 12));
        
        return updateDoc(memberRef, {
          membershipType: upgradePlan,
          membershipEndDate: newEndDateStr
        });
      }));

      toast({ title: "Success", description: `Upgraded ${ids.length} members to ${upgradePlan}.` });
      setSelectedIds(new Set());
      setUpgradePlan("");
      setBulkUpgradeOpen(false);
    } catch (err) {
      console.error("Bulk upgrade error:", err);
      toast({ title: "Error", description: "Failed to upgrade memberships.", variant: "destructive" });
    } finally {
      setIsUpgrading(false);
    }
  };

  const getStatusBadge = (endDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(endDate);
    expiryDate.setHours(0, 0, 0, 0);
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return <span className="bg-red-500/10 border border-red-500/20 text-red-500 px-2 py-0.5 rounded-md text-xs font-medium">Overdue</span>;
    }
    if (diffDays <= 5) {
      return <span className="bg-orange-500/10 border border-orange-500/20 text-orange-500 px-2 py-0.5 rounded-md text-xs font-medium">Expiring</span>; 
    }
    return <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-2 py-0.5 rounded-md text-xs font-medium">Active</span>;
  };

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-lg font-semibold">{title}</h3>
          <div className="flex items-center gap-2">
            {someSelected && !hideSelection ? (
              <div className="flex flex-wrap bg-[#B6916D]/10 text-[#B6916D] px-2 py-1.5 rounded-md items-center gap-1.5 sm:gap-2 max-w-full">
                <span className="text-xs sm:text-sm font-medium px-1 flex items-center">
                  {selectedIds.size} Selected
                  <button onClick={() => setSelectedIds(new Set())} className="ml-1.5 hover:bg-[#B6916D]/20 rounded-full p-0.5 transition-colors" title="Clear selection">
                    <X className="h-3 w-3" />
                  </button>
                </span>
                <Button variant="outline" size="sm" onClick={handleExportSelected} className="h-7 text-[10px] sm:text-xs border-[#B6916D]/30 px-2 sm:px-3"><Download className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Export</span></Button>
                <Button variant="outline" size="sm" onClick={() => setBulkExtendOpen(true)} className="h-7 text-[10px] sm:text-xs border-[#B6916D]/30 px-2 sm:px-3"><CalendarPlus className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Extend</span></Button>
                <Button variant="outline" size="sm" onClick={() => setBulkUpgradeOpen(true)} className="h-7 text-[10px] sm:text-xs border-[#B6916D]/30 px-2 sm:px-3"><ArrowUpCircle className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Upgrade</span></Button>
                <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)} className="h-7 text-[10px] sm:text-xs border-red-500/30 text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2 sm:px-3"><Trash2 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Trash</span></Button>
              </div>
            ) : (
              <Badge variant="outline">{members.length} Members</Badge>
            )}
          </div>
        </div>
      )}

      {!title && someSelected && !hideSelection && (
        <div className="flex justify-end">
          <div className="flex flex-wrap bg-[#6F51FF]/10 text-[#6F51FF] px-2 py-1.5 rounded-md items-center gap-1.5 sm:gap-2 max-w-full">
            <span className="text-xs sm:text-sm font-medium px-1 flex items-center">
              {selectedIds.size} Selected
              <button onClick={() => setSelectedIds(new Set())} className="ml-1.5 hover:bg-[#6F51FF]/20 rounded-full p-0.5 transition-colors" title="Clear selection">
                <X className="h-3 w-3" />
              </button>
            </span>
            <Button variant="outline" size="sm" onClick={handleExportSelected} className="h-7 text-[10px] sm:text-xs border-[#6F51FF]/30 px-2 sm:px-3"><Download className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Export</span></Button>
            <Button variant="outline" size="sm" onClick={() => setBulkExtendOpen(true)} className="h-7 text-[10px] sm:text-xs border-[#6F51FF]/30 px-2 sm:px-3"><CalendarPlus className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Extend</span></Button>
            <Button variant="outline" size="sm" onClick={() => setBulkUpgradeOpen(true)} className="h-7 text-[10px] sm:text-xs border-[#6F51FF]/30 px-2 sm:px-3"><ArrowUpCircle className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Upgrade</span></Button>
            <Button variant="outline" size="sm" onClick={() => setBulkDeleteOpen(true)} className="h-7 text-[10px] sm:text-xs border-red-500/30 text-red-500 hover:text-red-600 hover:bg-red-500/10 px-2 sm:px-3"><Trash2 className="h-3 w-3 sm:mr-1" /><span className="hidden sm:inline"> Trash</span></Button>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-transparent">
            <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
              {!hideSelection && (
                <TableHead className="w-12 px-4">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" className="border-muted-foreground/30 data-[state=checked]:bg-[#6F51FF] data-[state=checked]:border-[#6F51FF] rounded border" />
                </TableHead>
              )}
              <TableHead className="text-muted-foreground font-medium h-12 min-w-[150px]">Member</TableHead>
              <TableHead className="hidden md:table-cell text-muted-foreground font-medium">Nickname</TableHead>
              <TableHead className="hidden lg:table-cell text-muted-foreground font-medium">Member ID</TableHead>
              <TableHead className="text-muted-foreground font-medium">Plan</TableHead>
              <TableHead className="hidden sm:table-cell text-muted-foreground font-medium">Start Date</TableHead>
              <TableHead className="text-muted-foreground font-medium">Renewal Date</TableHead>
              <TableHead className="hidden md:table-cell text-muted-foreground font-medium">Training</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="hidden xl:table-cell text-muted-foreground font-medium">Gender</TableHead>
              <TableHead className="text-muted-foreground font-medium">Fees</TableHead>
              <TableHead className="static sm:sticky sm:right-0 bg-transparent sm:bg-[#1A1A2E] z-0 sm:z-20 text-right text-muted-foreground font-medium px-4 shadow-none sm:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentMembers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={hideSelection ? 10 : 11} className="text-center py-10 text-muted-foreground border-b-0">
                  No members found in this category.
                </TableCell>
              </TableRow>
            ) : (
              currentMembers.map((member) => (
                  <TableRow 
                    key={member.memberId} 
                    data-state={selectedIds.has(member.memberId) ? "selected" : undefined}
                    className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer ${activeRowId === member.memberId ? "bg-white/[0.04]" : ""}`}
                    onClick={() => router.push(`/admin/member/${member.memberId}`)}
                  >
                  {!hideSelection && (
                    <TableCell className="px-4" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(member.memberId)}
                        onCheckedChange={() => toggleOne(member.memberId)}
                        aria-label={`Select ${member.fullName}`}
                        className="border-muted-foreground/30 data-[state=checked]:bg-[#B6916D] data-[state=checked]:border-[#B6916D] rounded border bg-[#131313]"
                      />
                    </TableCell>
                  )}
                  <TableCell className="min-w-[150px]">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted/20 border border-muted/30 overflow-hidden flex items-center justify-center shrink-0">
                        {member.photoUrl ? (
                          <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-medium text-muted-foreground">{member.fullName.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground truncate max-w-[100px] sm:max-w-[150px]">{member.fullName}</span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[100px] sm:max-w-[150px]" title={member.email || member.phone || "No details"}>{member.phone || member.email}</span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {gymId && (
                      <InlineEditCell
                        memberId={member.memberId}
                        member={member}
                        gymId={gymId}
                        field="nickname"
                        value={member.nickname}
                        placeholder="click to add"
                        onActive={(isActive) => setActiveRowId(isActive ? member.memberId : null)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden lg:table-cell">
                    {member.memberId}
                  </TableCell>
                  <TableCell>
                    <span className="capitalize text-sm text-muted-foreground">{member.membershipType}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{format(new Date(member.membershipStartDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{format(new Date(member.membershipEndDate), "MMM dd, yyyy")}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-1.5">
                      {member.trainingType === "personal" ? (
                        <div className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-500/20">
                          <Zap className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase">PT</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                          <User className="h-3 w-3" />
                          <span className="text-[10px] font-bold uppercase">GT</span>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(member.membershipEndDate)}</TableCell>
                  <TableCell className="capitalize text-sm text-muted-foreground hidden xl:table-cell">{member.gender}</TableCell>
                  <TableCell>
                    {gymId && (
                      <InlineEditCell
                        memberId={member.memberId}
                        member={member}
                        gymId={gymId}
                        field="feesPaid"
                        value={member.filteredFeesPaid !== undefined ? member.filteredFeesPaid : member.feesPaid}
                        type="number"
                        prefix={<IndianRupee className="h-3 w-3 text-muted-foreground mr-0.5" />}
                        disabled={member.filteredFeesPaid !== undefined || (member.feesPaid !== undefined && member.feesPaid > 0)}
                        onActive={(isActive) => setActiveRowId(isActive ? member.memberId : null)}
                      />
                    )}
                  </TableCell>
                  <TableCell className="static sm:sticky sm:right-0 z-0 sm:z-10 bg-transparent sm:bg-[#1A1A2E] text-right px-4 shadow-none sm:shadow-[-2px_0_5px_-2px_rgba(0,0,0,0.3)]">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-white" onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/admin/member/${member.memberId}`);
                      }}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <div onClick={(e) => e.stopPropagation()}>
                        <RenewMembershipPopover 
                          member={member} 
                          onActive={(isActive) => setActiveRowId(isActive ? member.memberId : null)}
                          align="end"
                        />
                      </div>
                      {showDoneButton && (() => {
                        const hasFees = member.feesPaid !== undefined && member.feesPaid !== null && member.feesPaid > 0;
                        return (
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-8 w-8 ${hasFees ? "text-green-500 hover:text-green-400 hover:bg-green-500/10" : "text-muted-foreground/30 cursor-not-allowed"}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (hasFees) handleDone(member);
                            }}
                            disabled={!hasFees}
                            title={hasFees ? "Acknowledge member" : "Enter fees first to acknowledge"}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        );
                      })()}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-muted/20 text-sm">
            <div className="text-muted-foreground">
              Showing {(validPage - 1) * itemsPerPage + 1} to {Math.min(validPage * itemsPerPage, members.length)} of {members.length} Members
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent border-muted/20 hover:bg-muted/10 hover:text-white"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={validPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (
                  page === 1 ||
                  page === totalPages ||
                  Math.abs(page - validPage) <= 1
                ) {
                  return (
                    <Button
                      key={page}
                      variant="outline"
                      className={`h-8 w-8 p-0 border text-sm font-medium ${page === validPage ? 'bg-[#1C1C1E] border-[#B6916D] text-[#B6916D]' : 'bg-transparent border-transparent text-muted-foreground hover:border-muted/20 hover:text-white'}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                }
                if (
                  page === validPage - 2 ||
                  page === validPage + 2
                ) {
                  return <span key={page} className="px-1 text-muted-foreground">...</span>;
                }
                return null;
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent border-muted/20 hover:bg-muted/10 hover:text-white"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={validPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete Members</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} selected member(s)? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)} disabled={isBulkDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={isBulkDeleting}>
              {isBulkDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Extend Dialog */}
      <Dialog open={bulkExtendOpen} onOpenChange={setBulkExtendOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#B6916D]">Add Days to Membership</DialogTitle>
            <DialogDescription>
              Extend the membership end dates for {selectedIds.size} selected member(s).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="days-extend">Days to Extend</Label>
              <Input
                id="days-extend"
                type="number"
                min="1"
                placeholder="e.g. 5"
                value={extendDays || ""}
                onChange={(e) => setExtendDays(parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Button variant="outline" size="sm" onClick={() => setExtendDays(5)}>+5 Days</Button>
              <Button variant="outline" size="sm" onClick={() => setExtendDays(14)}>+14 Days</Button>
              <Button variant="outline" size="sm" onClick={() => setExtendDays(30)}>+30 Days</Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkExtendOpen(false)} disabled={isExtending}>
              Cancel
            </Button>
            <Button onClick={handleBulkExtend} disabled={isExtending || extendDays <= 0} className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white">
              {isExtending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Extending...</> : "Confirm Extension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upgrade Dialog */}
      <Dialog open={bulkUpgradeOpen} onOpenChange={setBulkUpgradeOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-[#6F51FF]">Upgrade Memberships</DialogTitle>
            <DialogDescription>
              Change the plan type for {selectedIds.size} selected member(s). This will automatically append the new plan length to their current end date.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select New Plan</Label>
              <Select value={upgradePlan} onValueChange={(v) => setUpgradePlan(v || "")}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a plan..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly (30 Days)</SelectItem>
                  <SelectItem value="quarterly">Quarterly (90 Days)</SelectItem>
                  <SelectItem value="half-yearly">Half-Yearly (180 Days)</SelectItem>
                  <SelectItem value="yearly">Yearly (365 Days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkUpgradeOpen(false)} disabled={isUpgrading}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpgrade} disabled={isUpgrading || !upgradePlan} className="bg-[#6F51FF] hover:bg-[#6F51FF]/90 text-white">
              {isUpgrading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Upgrading...</> : "Confirm Upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Done Confirmation Dialog */}
      <Dialog open={doneDialogOpen} onOpenChange={(v) => !isConfirmingDone && setDoneDialogOpen(v)}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-white">
              <Check className="h-5 w-5 text-green-400" />
              Acknowledge New Member
            </DialogTitle>
            <DialogDescription className="text-[#8888A0]">
              Confirm details for <span className="font-semibold text-[#B6916D]">{doneTargetMember?.fullName}</span> before removing from dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="space-y-1.5 w-full sm:w-1/2">
                <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Training Type</Label>
                <Select value={doneTrainingType} onValueChange={(v: any) => { setDoneTrainingType(v); if (v === "general") setDonePersonalTrainerId(""); }}>
                  <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                    <SelectItem value="general">General Training</SelectItem>
                    <SelectItem value="personal">Personal Training</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {doneTrainingType === "personal" && (
                <div className="space-y-1.5 w-full sm:w-1/2">
                  <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Select Trainer</Label>
                  <Select value={donePersonalTrainerId} onValueChange={(v: any) => setDonePersonalTrainerId(v)}>
                    <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                      <SelectValue placeholder="Choose a trainer..." />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      {doneStaff.map(t => (
                        <SelectItem key={t.staffId} value={t.staffId}>{t.fullName}</SelectItem>
                      ))}
                      {doneStaff.length === 0 && <div className="p-2 text-sm text-muted-foreground text-center">No trainers available</div>}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {doneTrainingType === "personal" && (
              <div className="space-y-1.5 w-full">
                <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Base Gym Fee (per month) <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  min="0"
                  value={donePtGymFee}
                  onChange={(e) => setDonePtGymFee(e.target.value)}
                  className="h-10 bg-white/[0.04] border-white/[0.08] text-white"
                />
                <p className="text-[10px] text-gray-500 italic mt-0.5">Deducted from PT fee for gym share.</p>
              </div>
            )}
            <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="done-with-gst"
                  checked={doneWithGst}
                  onChange={(e) => setDoneWithGst(e.target.checked)}
                  disabled={activeGym?.gstStatus !== 'validated'}
                  className="w-4 h-4 rounded border-white/[0.08] bg-white/[0.04] accent-[#B6916D] disabled:opacity-50"
                />
                <Label htmlFor="done-with-gst" className={`text-sm ${activeGym?.gstStatus !== 'validated' ? 'text-[#8888A0]/50' : 'text-[#8888A0]'} cursor-pointer`}>
                  Generate GST Invoice (5% = 2.5% CGST + 2.5% SGST)
                </Label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Standard Fee (Base Price) (₹) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                placeholder="e.g. 2200"
                value={doneBasePrice}
                onChange={(e) => setDoneBasePrice(e.target.value)}
                className="h-10 bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Offer Type</Label>
                <Select value={doneOfferType} onValueChange={setDoneOfferType}>
                  <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                    <SelectValue placeholder="No Offer" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                    <SelectItem value="">No Offer</SelectItem>
                    <SelectItem value="Student">Student</SelectItem>
                    <SelectItem value="Couple">Couple</SelectItem>
                    <SelectItem value="Combo">Combo</SelectItem>
                    <SelectItem value="Individual">Individual</SelectItem>
                    <SelectItem value="Group">Group</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {doneOfferType && (
                <div className="space-y-1.5">
                  <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Discount Type</Label>
                  <Select value={doneDiscountType} onValueChange={(v: any) => setDoneDiscountType(v)}>
                    <SelectTrigger className="h-10 bg-white/[0.04] border-white/[0.08] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      <SelectItem value="amount">Fixed Amount (₹)</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
              {doneOfferType && (
                <div className="space-y-1.5">
                  <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Discount Value</Label>
                  <Input
                    type="number"
                    placeholder={doneDiscountType === "percentage" ? "e.g. 10" : "e.g. 500"}
                    value={doneDiscountValue}
                    onChange={(e) => setDoneDiscountValue(e.target.value)}
                    className="h-10 bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50"
                  />
                </div>
              )}
            </div>
            {doneOfferType && (
              <div className="space-y-1.5">
                <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Offer Remark</Label>
                <textarea
                  placeholder="e.g. Student discount applied after ID check"
                  value={doneOfferRemark}
                  onChange={(e) => setDoneOfferRemark(e.target.value)}
                  className="w-full min-h-[80px] p-3 rounded-md bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-white/20 text-sm"
                />
              </div>
            )}

            {doneOfferType && (
              <div className="space-y-1 px-4 py-2 bg-white/[0.02] border border-white/[0.06] rounded-md">
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Standard Fee:</span>
                  <span className="text-white font-medium">₹{(Number(doneBasePrice) || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Discount Amount:</span>
                  <span className="text-red-400 font-medium">
                    -₹{(doneDiscountType === "percentage" 
                      ? Math.round((Number(doneBasePrice) * Number(doneDiscountValue)) / 100)
                      : Number(doneDiscountValue) || 0
                    ).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-bold border-t border-white/[0.04] mt-1 pt-1">
                  <span className="text-[#B6916D]">Calculated Payable:</span>
                  <span className="text-[#B6916D]">₹{(doneDiscountType === "percentage" 
                    ? Math.max(0, Math.round(Number(doneBasePrice) - (Number(doneBasePrice) * Number(doneDiscountValue)) / 100))
                    : Math.max(0, Number(doneBasePrice) - (Number(doneDiscountValue) || 0))
                  ).toLocaleString()}</span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[#8888A0] text-xs font-bold uppercase tracking-wider">Paid Today / Upfront (₹) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                value={doneFeesPaid}
                onChange={(e) => setDoneFeesPaid(e.target.value)}
                className="h-10 bg-[#B6916D]/10 border-[#B6916D]/30 text-white font-bold"
              />
            </div>

            <div className="pt-2">
              <PaymentSplitter 
                recipients={activeGym?.paymentRecipients || []}
                initialTotal={Number(doneFeesPaid) || 0}
                initialSplits={donePaymentSplits}
                onChange={setDonePaymentSplits}
              />
            </div>
            
            <div className="pt-2">
              <InstallmentManager 
                installments={doneInstallments}
                onChange={setDoneInstallments}
                payableAmount={doneFinalFee}
                paidAmount={Number(doneFeesPaid) || 0}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDoneDialogOpen(false)} disabled={isConfirmingDone} className="bg-transparent border-white/[0.08] text-[#8888A0] hover:bg-white/[0.04]">
              Cancel
            </Button>
            <Button
              onClick={confirmDone}
              disabled={
                isConfirmingDone || 
                (doneTrainingType === "personal" && !donePersonalTrainerId) ||
                (donePaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) !== (doneTargetMember?.feesPaid || 0)) ||
                donePaymentSplits.some(s => !s.receivedBy)
              }
              className="bg-green-600 hover:bg-green-500 text-white font-semibold"
            >
              {isConfirmingDone ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</> : <><Check className="h-4 w-4 mr-2" />Confirm & Done</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
