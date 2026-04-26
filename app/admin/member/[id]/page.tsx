"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/hooks/use-toast";
import { doc, getDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import { archiveMember } from "@/lib/firebase/archive";
import { Member, Staff, Payment } from "@/types";
import AdminSidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import FamilyManager from "@/components/admin/shared/FamilyManager";
import { arrayUnion, arrayRemove } from "firebase/firestore";
import { downloadInvoicePdf, getInvoicePdfBase64 } from "@/lib/invoice";

import { Loader2, ArrowLeft, Save, Trash2, RefreshCw, Camera, User, Zap, Mail, Phone, MapPin, MessageSquare, Edit, Download } from "lucide-react";
import RenewMembershipPopover from "@/components/admin/RenewMembershipPopover";
import PaymentSplitter, { SplitPayment } from "@/components/admin/shared/PaymentSplitter";
import InstallmentManager from "@/components/admin/shared/InstallmentManager";
import { compressAndUploadPhoto } from "@/lib/cloudinary";
import { deleteCloudinaryImage } from "@/app/actions/cloudinary";
import { getRegistrationWhatsAppTextAction } from "@/app/register/actions";
import { getTrialWhatsAppTextAction } from "@/app/trial/actions";
import { format } from "date-fns";
import { addExactMonths, formatDateOnly } from "@/lib/utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const formSchema = z.object({
  fullName: z.string().min(2, "Full name is required"),
  nickname: z.string().optional(),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Phone number must be 10 digits and start with 6, 7, 8, or 9"),
  address: z.string().optional(),
  dob: z.string().optional(),
  gender: z.string().optional(),
  healthAssessment: z.string().optional(),
  fitnessGoals: z.string().optional(),
  isTakingMedication: z.string().optional(),
  notes: z.string().optional(),
  withGst: z.boolean().optional(),
  bloodGroup: z.string().optional(),
  profession: z.string().optional(),
  offerType: z.string().optional(),
  offerRemark: z.string().optional(),
  discountValue: z.string().optional(),
});

const PLAN_TYPE_OPTIONS = [
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "half-yearly", label: "Half-Yearly" },
  { value: "yearly", label: "Yearly" },
  { value: "trial", label: "Trial" },
  { value: "custom", label: "Custom" },
];

type EditablePlanRecord = {
  planType: string;
  startDate: string;
  endDate: string;
  amountPaid: number;
  trainingType: "general" | "personal";
  personalTrainerId: string | null;
  historyIndex: number | null;
  isCurrent: boolean;
  paymentSplits?: SplitPayment[];
  installments?: Installment[];
  offerType?: string;
  offerRemark?: string;
  discountValue?: string;
  discountType?: "amount" | "percentage";
  basePrice?: number;
  ptGymFee?: number;
  withGst?: boolean;
};

const PLAN_TYPE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  "half-yearly": 6,
  yearly: 12,
};

export default function MemberDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { adminData, activeGym, frontDeskData, user, isFrontDesk, loading: authLoading } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [planEditorOpen, setPlanEditorOpen] = useState(false);
  const [isPlanUpdating, setIsPlanUpdating] = useState(false);
  const [editingPlan, setEditingPlan] = useState<EditablePlanRecord | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [emailingPlanId, setEmailingPlanId] = useState<string | null>(null);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [familyData, setFamilyData] = useState<Member[]>([]);
  const [isLoadingFamily, setIsLoadingFamily] = useState(false);

  // Personal Trainer state
  const [assignedTrainer, setAssignedTrainer] = useState<Staff | null>(null);
  const [gymTrainers, setGymTrainers] = useState<Staff[]>([]);
  const [planForm, setPlanForm] = useState({
    planType: "monthly",
    startDate: "",
    endDate: "",
    amountPaid: "",
    trainingType: "general" as "general" | "personal",
    personalTrainerId: "",
    withGst: false,
    offerType: "",
    offerRemark: "",
    discountValue: "",
    discountType: "amount" as "amount" | "percentage",
    basePrice: "",
    ptGymFee: "2000",
  });
  const [planPaymentSplits, setPlanPaymentSplits] = useState<SplitPayment[]>([]);
  const [planInstallments, setPlanInstallments] = useState<Installment[]>([]);

  // Derived calculated final fee for Plan Editor
  const baseP = Number(planForm.basePrice) || 0;
  const discV = Number(planForm.discountValue) || 0;
  const hasOff = !!planForm.offerType;
  let calculatedFinalFee = baseP;
  if (hasOff) {
    if (planForm.discountType === "percentage") {
      calculatedFinalFee = Math.max(0, Math.round(baseP - (baseP * discV / 100)));
    } else {
      calculatedFinalFee = Math.max(0, baseP - discV);
    }
  }

  const { toast } = useToast();

  const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gymId || !member) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 10MB.", variant: "destructive" });
      return;
    }

    setIsPhotoUpdating(true);
    const { dismiss } = toast({ title: "Updating Photo...", description: "Compressing and uploading to storage.", duration: Infinity });
    
    try {
      const oldPhotoUrl = member.photoUrl;
      const photoUrl = await compressAndUploadPhoto(file, gymId, member.memberId);
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      await updateDoc(memberRef, { photoUrl });
      
      if (oldPhotoUrl && oldPhotoUrl.includes("cloudinary.com")) {
        deleteCloudinaryImage(oldPhotoUrl).catch(console.error);
      }
      
      setMember(prev => prev ? { ...prev, photoUrl } : null);
      dismiss();
      toast({ title: "Photo Updated", description: "Member photo has been updated successfully." });
    } catch (error) {
      dismiss();
      console.error("Error updating photo:", error);
      const errorMsg = error instanceof Error ? error.message : "Failed to update photo. Check your connection.";
      toast({ title: "Error", description: errorMsg, variant: "destructive" });
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  const handleSendFormCopy = async () => {
    if (!id || !gymId || !member) return;

    setIsSendingWhatsApp(true);
    try {
      let result;
      if (member.membershipType === "trial") {
        result = await getTrialWhatsAppTextAction(member.memberId, gymId);
      } else {
        result = await getRegistrationWhatsAppTextAction(member.memberId, gymId);
      }

      if (result.success && result.text) {
        const encodedMessage = encodeURIComponent(result.text);
        const whatsappUrl = `https://wa.me/91${result.phone || member.phone}?text=${encodedMessage}`;
        window.open(whatsappUrl, "_blank");
        toast({ title: "Opening WhatsApp...", description: "Check your local WhatsApp window." });
      } else {
        throw new Error(result.error || "Failed to generate message text.");
      }
    } catch (error) {
      console.error("Error generating manual WhatsApp text:", error);
      toast({ 
        title: "Failed to load", 
        description: "Could not generate message copy. Try again.", 
        variant: "destructive" 
      });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
  });

  useEffect(() => {
    const base = Number(planForm.basePrice) || 0;
    const discValue = Number(planForm.discountValue) || 0;
    const hasOffer = !!planForm.offerType;

    if (!hasOffer) {
      setPlanForm(prev => ({ ...prev, amountPaid: String(base) }));
    } else {
      let calcFee = base;
      if (planForm.discountType === "percentage") {
        calcFee = Math.max(0, Math.round(base - (base * discValue / 100)));
      } else {
        calcFee = Math.max(0, base - discValue);
      }
      setPlanForm(prev => ({ ...prev, amountPaid: String(calcFee) }));
    }
  }, [planForm.basePrice, planForm.discountValue, planForm.discountType, planForm.offerType]);

  useEffect(() => {
    if (!id || !gymId) return;

    setLoading(true);
    let unsubMember: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let unsubStaff: (() => void) | undefined;

    const setupListeners = () => {
      try {
        // 1. Member Listener
        unsubMember = onSnapshot(doc(db, "gyms", gymId, "members", id as string), (memberDoc) => {
          if (memberDoc.exists()) {
            const data = memberDoc.data() as Member;
            setMember({ ...data, memberId: memberDoc.id });

            form.reset({
              fullName: data.fullName,
              nickname: data.nickname || "",
              email: data.email,
              phone: data.phone,
              address: data.address || "",
              dob: data.dob || "",
              gender: data.gender || "",
              healthAssessment: data.healthAssessment || "",
              fitnessGoals: data.fitnessGoals || "",
              isTakingMedication: data.isTakingMedication || "no",
              notes: data.notes || "",
              withGst: !!(data as any).withGst,
              bloodGroup: data.bloodGroup || "",
              profession: data.profession || "",
              offerType: data.offerType || "",
              offerRemark: data.offerRemark || "",
            });

            // Handle trainer details if exists
            if (data.personalTrainerId) {
               getDoc(doc(db, "gyms", gymId, "staff", data.personalTrainerId)).then(trainerDoc => {
                 if (trainerDoc.exists()) {
                   setAssignedTrainer({ staffId: trainerDoc.id, ...trainerDoc.data() } as Staff);
                 }
               });
            } else {
              setAssignedTrainer(null);
            }
          }
          setLoading(false);
        });

        // 2. Payments Listener
        unsubPayments = onSnapshot(query(collection(db, "gyms", gymId, "payments"), where("memberId", "==", id as string)), (snapshot) => {
          const memberPayments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }) as any);
          memberPayments.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setPayments(memberPayments);
        });

        // 3. Staff/Trainers Listener (for dropdown)
        unsubStaff = onSnapshot(query(collection(db, "gyms", gymId, "staff"), where("role", "==", "Trainer")), (snapshot) => {
          setGymTrainers(snapshot.docs.map(d => ({ staffId: d.id, ...d.data() })) as Staff[]);
        });

      } catch (err) {
        console.error("Member detail listeners error:", err);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubMember?.();
      unsubPayments?.();
      unsubStaff?.();
    };
  }, [id, form, gymId]);

  useEffect(() => {
    const fetchFamily = async () => {
      if (!gymId || !member?.familyMemberIds?.length) {
        setFamilyData([]);
        return;
      }
      setIsLoadingFamily(true);
      try {
        const results: Member[] = [];
        for (const fid of member.familyMemberIds) {
          const docRef = doc(db, "gyms", gymId, "members", fid);
          const dSnap = await getDoc(docRef);
          if (dSnap.exists()) {
            results.push({ memberId: dSnap.id, ...dSnap.data() } as Member);
          }
        }
        setFamilyData(results);
      } catch (err) {
        console.error("Error fetching family data:", err);
      } finally {
        setIsLoadingFamily(false);
      }
    };
    fetchFamily();
  }, [member?.familyMemberIds, gymId]);

  const onAddFamily = async (otherId: string) => {
    if (!gymId || !member) return;
    try {
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      const otherRef = doc(db, "gyms", gymId, "members", otherId);
      await updateDoc(memberRef, { familyMemberIds: arrayUnion(otherId) });
      await updateDoc(otherRef, { familyMemberIds: arrayUnion(member.memberId) });
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
      toast({ title: "Family Removed", description: "Connection broken." });
    } catch (err) {
      console.error(err);
      toast({ title: "Error", description: "Failed to remove connection.", variant: "destructive" });
    }
  };

  const onUpdate = async (values: z.infer<typeof formSchema>) => {
    setIsUpdating(true);
    try {
      // Validate email uniqueness if provided
      if (values.email && values.email !== member?.email) {
        const emailQuery = query(collection(db, "gyms", gymId!, "members"), where("email", "==", values.email));
        const emailDocs = await getDocs(emailQuery);
        if (!emailDocs.empty) {
          toast({ title: "Error", description: "Email already exists for another member.", variant: "destructive", toast: undefined });
          setIsUpdating(false);
          return;
        }
      }
      
      // Validate phone uniqueness
      if (values.phone !== member?.phone) {
        const phoneQuery = query(collection(db, "gyms", gymId!, "members"), where("phone", "==", values.phone));
        const phoneDocs = await getDocs(phoneQuery);
        if (!phoneDocs.empty) {
          toast({ title: "Error", description: "Phone number already exists for another member.", variant: "destructive", toast: undefined });
          setIsUpdating(false);
          return;
        }
      }

      const memberRef = doc(db, "gyms", gymId!, "members", id as string);
      const { gender, isTakingMedication, notes, withGst, offerType, offerRemark, discountValue, ...restValues } = values;

      // Include gender, isTakingMedication, notes, and withGst in update payload
      const extraFields: Record<string, any> = {};
      if (gender !== undefined) extraFields.gender = gender;
      if (isTakingMedication !== undefined) extraFields.isTakingMedication = isTakingMedication;
      if (withGst !== undefined) extraFields.withGst = withGst;
      if (offerType !== undefined) extraFields.offerType = offerType;
      if (offerRemark !== undefined) extraFields.offerRemark = offerRemark;
      if (discountValue !== undefined) extraFields.discountValue = discountValue;
      
      // Handle notes and notesHistory
      if (notes !== undefined && notes !== (member?.notes || "")) {
        extraFields.notes = notes;
        const historyEntry = {
          date: new Date().toISOString(),
          note: member?.notes || ""
        };
        // Only add to history if there was a previous note
        if (member?.notes) {
          extraFields.notesHistory = [historyEntry, ...(member.notesHistory || [])];
        }
      }
      
      await updateDoc(memberRef, { 
        ...restValues, 
        ...extraFields, 
      });
      
      // Always update local member state with all form values
      setMember(prev => prev ? {
        ...prev,
        ...restValues,
        gender: (gender as any) || prev.gender,
        isTakingMedication: isTakingMedication || prev.isTakingMedication,
        notes: notes !== undefined ? notes : prev.notes,
        notesHistory: extraFields.notesHistory || prev.notesHistory,
        offerType: offerType || prev.offerType,
        offerRemark: offerRemark || prev.offerRemark,
        discountValue: discountValue || prev.discountValue,
      } : null);

      toast({ title: "Success", description: "Member details updated successfully.", toast: undefined });
      setEditProfileOpen(false);
    } catch (error) {
      console.error("Error updating member:", error);
      toast({ title: "Error", description: "Failed to update member.", variant: "destructive", toast: undefined });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteNote = async (noteIndex: number) => {
    if (!gymId || !member) return;
    try {
      const updatedHistory = [...(member.notesHistory || [])];
      updatedHistory.splice(noteIndex, 1);
      const memberRef = doc(db, "gyms", gymId, "members", member.memberId);
      await updateDoc(memberRef, { notesHistory: updatedHistory });
      setMember(prev => prev ? { ...prev, notesHistory: updatedHistory } : null);
      toast({ title: "Deleted", description: "Note removed from history." });
    } catch (error) {
      console.error("Error deleting note:", error);
      toast({ title: "Error", description: "Failed to delete note.", variant: "destructive" });
    }
  };

  const onDelete = async () => {
    if (!gymId || !user || isFrontDesk) return;
    setIsUpdating(true);
    try {
      await archiveMember(gymId, id as string, user.uid);
      toast({ title: "Deleted", description: "Member has been archived and removed.", toast: undefined });
      router.push("/admin/members");
    } catch (error) {
      console.error("Error deleting member:", error);
      toast({ title: "Error", description: "Failed to delete member.", variant: "destructive", toast: undefined });
      setIsUpdating(false);
    }
    setShowDeleteDialog(false);
  };

  const getPaymentForPlan = (record: {
    planType: string;
    startDate: string;
    amountPaid: number;
    endDate: string;
  }) => {
    let payment = payments.find(p => p.planType === record.planType && p.startDate === record.startDate);

    if (!payment) {
      payment = payments.find(p =>
        p.amount === record.amountPaid &&
        p.date &&
        p.date.substring(0, 7) === record.startDate?.substring(0, 7)
      );
    }
    if (!payment) {
      payment = payments.find(p => p.amount === record.amountPaid);
    }
    if (!payment && payments.length === 1) {
      payment = payments[0];
    }

    if (payment && !payment.planType) {
      payment = { ...payment, planType: record.planType, startDate: record.startDate, endDate: record.endDate };
    }
    return payment;
  };

  const openPlanEditor = (record: EditablePlanRecord) => {
    setEditingPlan(record);
    
    // amountPaid accumulates over time (upfront + paid installments).
    // To get the original upfront, subtract paid installments.
    const paidInstallmentsSum = (record.installments || [])
      .filter(i => i.status === "paid")
      .reduce((sum, i) => sum + i.amount, 0);
    const originalUpfront = (record.amountPaid ?? 0) - paidInstallmentsSum;

    setPlanForm({
      planType: record.planType,
      startDate: record.startDate,
      endDate: record.endDate,
      amountPaid: String(originalUpfront),
      trainingType: record.trainingType,
      personalTrainerId: record.personalTrainerId || "",
      withGst: !!record.withGst,
      offerType: record.offerType || "",
      offerRemark: record.offerRemark || "",
      discountValue: record.discountValue || "",
      discountType: record.discountType || "amount",
      basePrice: record.basePrice?.toString() || record.amountPaid?.toString() || "",
      ptGymFee: record.ptGymFee?.toString() || "2000",
    });
    setPlanPaymentSplits(
      (record.paymentSplits && record.paymentSplits.length > 0) 
        ? record.paymentSplits 
        : [{ amount: originalUpfront, receivedBy: "", paymentMode: "cash" }]
    );
    setPlanInstallments(record.installments || []);
    setPlanEditorOpen(true);
  };

  const syncPlanEndDate = (startDate: string, planType: string) => {
    if (!startDate) return "";
    if (planType === "trial") {
      const start = new Date(`${startDate}T00:00:00`);
      return formatDateOnly(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1));
    }

    const months = PLAN_TYPE_MONTHS[planType];
    if (!months) return "";

    return formatDateOnly(addExactMonths(startDate, months));
  };

  const handlePlanUpdate = async () => {
    if (!gymId || !member || !editingPlan) return;

    const amountPaid = Number(planForm.amountPaid) || 0;
    const trainingType = planForm.trainingType;
    const personalTrainerId = trainingType === "personal" ? (planForm.personalTrainerId || null) : null;
    const updatedPlan = {
      planType: planForm.planType.trim() || "custom",
      startDate: planForm.startDate,
      endDate: planForm.endDate,
      amountPaid,
      trainingType,
      personalTrainerId,
      withGst: !!planForm.withGst,
      paymentSplits: planPaymentSplits,
      offerType: planForm.offerType,
      offerRemark: planForm.offerRemark,
      discountValue: planForm.discountValue,
      discountType: planForm.discountType,
      basePrice: Number(planForm.basePrice) || 0,
      ptGymFee: trainingType === "personal" ? Number(planForm.ptGymFee) : 0,
      installments: planInstallments,
    };

    if (!updatedPlan.startDate || !updatedPlan.endDate) {
      toast({ title: "Missing dates", description: "Start and end date are required.", variant: "destructive" });
      return;
    }

    if (trainingType === "personal") {
      if (!planForm.ptGymFee) {
        toast({ title: "Missing Fields", description: "Base Gym Fee is required for Personal Training.", variant: "destructive" });
        return;
      }
      
      let months = 1;
      if (planForm.planType === "monthly") months = 1;
      else if (planForm.planType === "quarterly") months = 3;
      else if (planForm.planType === "half-yearly") months = 6;
      else if (planForm.planType === "yearly") months = 12;

      const monthlyFee = calculatedFinalFee / months;
      if (monthlyFee <= (Number(planForm.ptGymFee) * 2)) {
        toast({ 
          title: "Invalid Fee", 
          description: `Total Monthly PT fee (₹${monthlyFee.toFixed(0)}) must be strictly greater than double of Base Gym Fees (₹${Number(planForm.ptGymFee) * 2}).`, 
          variant: "destructive" 
        });
        return;
      }
    }

    const totalSplitAmount = planPaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
    if (totalSplitAmount !== Number(planForm.amountPaid)) {
      toast({ title: "Payment Mismatch", description: `Split amounts (₹${totalSplitAmount}) must sum up to Paid Today (₹${planForm.amountPaid}).`, variant: "destructive", toast: undefined });
      return;
    }

    const sumInstallments = planInstallments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    if (Number(planForm.amountPaid) + sumInstallments !== calculatedFinalFee) {
      toast({ title: "Balance Mismatch", description: `Paid Today + Installments must perfectly equal the Payable Amount (₹${calculatedFinalFee}).`, variant: "destructive", toast: undefined });
      return;
    }

    setIsPlanUpdating(true);
    try {
      const memberRef = doc(db, "gyms", gymId!, "members", member.memberId);
      const nextPlanHistory = [...(member.planHistory || [])];

      if (editingPlan.historyIndex !== null) {
        nextPlanHistory[editingPlan.historyIndex] = updatedPlan;
      }

      const memberUpdates: Record<string, any> = {};

      if (editingPlan.historyIndex !== null) {
        memberUpdates.planHistory = nextPlanHistory;
      }

      if (editingPlan.isCurrent) {
        memberUpdates.membershipType = updatedPlan.planType;
        memberUpdates.membershipStartDate = updatedPlan.startDate;
        memberUpdates.membershipEndDate = updatedPlan.endDate;
        memberUpdates.feesPaid = updatedPlan.amountPaid;
        memberUpdates.trainingType = updatedPlan.trainingType;
        memberUpdates.personalTrainerId = updatedPlan.personalTrainerId;
        memberUpdates.paymentSplits = updatedPlan.paymentSplits;
        memberUpdates.offerType = updatedPlan.offerType;
        memberUpdates.offerRemark = updatedPlan.offerRemark;
        memberUpdates.discountValue = updatedPlan.discountValue;
        memberUpdates.discountType = updatedPlan.discountType;
        memberUpdates.basePrice = updatedPlan.basePrice;
        memberUpdates.ptGymFee = updatedPlan.ptGymFee;
        memberUpdates.withGst = updatedPlan.withGst;
        memberUpdates.installments = updatedPlan.installments;
      }

      await updateDoc(memberRef, memberUpdates);

      // Find ALL payment documents linked to this plan (split payments share the same invoiceId)
      const linkedPayment = getPaymentForPlan(editingPlan);
      const paymentsRef = collection(db, "gyms", gymId!, "payments");
      let linkedPaymentIds: string[] = [];

      if (linkedPayment?.invoiceId) {
        // Find all sibling split docs by shared invoiceId
        const siblingSnap = await getDocs(query(paymentsRef, where("invoiceId", "==", linkedPayment.invoiceId)));
        linkedPaymentIds = siblingSnap.docs.map(d => d.id);
      } else if (linkedPayment?.id) {
        linkedPaymentIds = [linkedPayment.id];
      }

      // Delete all old payment documents for this plan
      for (const payId of linkedPaymentIds) {
        await deleteDoc(doc(db, "gyms", gymId!, "payments", payId));
      }

      // Create new payment documents — one per split — sharing a single invoiceId
      const sharedInvoiceId = linkedPayment?.invoiceId || `INV-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 1000)}`;
      for (const split of updatedPlan.paymentSplits) {
        if (Number(split.amount) > 0) {
          await addDoc(paymentsRef, {
            memberId: member.memberId,
            amount: Number(split.amount),
            date: linkedPayment?.date || new Date().toISOString(),
            type: linkedPayment?.type || "joining_fee",
            invoiceId: sharedInvoiceId,
            planType: updatedPlan.planType,
            startDate: updatedPlan.startDate,
            endDate: updatedPlan.endDate,
            trainingType: updatedPlan.trainingType,
            personalTrainerId: updatedPlan.personalTrainerId,
            withGst: updatedPlan.withGst,
            receivedBy: split.receivedBy,
            paymentMode: split.paymentMode || "cash",
            ptGymFee: updatedPlan.ptGymFee,
          });
        }
      }

      setMember(prev => {
        if (!prev) return prev;

        const nextMember = { ...prev };
        if (editingPlan.historyIndex !== null) {
          nextMember.planHistory = nextPlanHistory;
        }
        if (editingPlan.isCurrent) {
          nextMember.membershipType = updatedPlan.planType;
          nextMember.membershipStartDate = updatedPlan.startDate;
          nextMember.membershipEndDate = updatedPlan.endDate;
          nextMember.feesPaid = updatedPlan.amountPaid;
          nextMember.trainingType = updatedPlan.trainingType;
          nextMember.personalTrainerId = updatedPlan.personalTrainerId || undefined;
          (nextMember as any).withGst = updatedPlan.withGst;
          nextMember.paymentSplits = updatedPlan.paymentSplits;
          nextMember.offerType = updatedPlan.offerType;
          nextMember.offerRemark = updatedPlan.offerRemark;
          nextMember.discountValue = updatedPlan.discountValue;
          nextMember.discountType = updatedPlan.discountType;
          nextMember.basePrice = updatedPlan.basePrice;
          nextMember.ptGymFee = updatedPlan.ptGymFee;
        }
        return nextMember;
      });

      // Payments state will auto-refresh via onSnapshot listener

      if (editingPlan.isCurrent) {
        const trainer = personalTrainerId
          ? gymTrainers.find(item => item.staffId === personalTrainerId) || null
          : null;
        setAssignedTrainer(trainer);
      }

      toast({ title: "Plan updated", description: "Membership plan details were saved." });
      setPlanEditorOpen(false);
      setEditingPlan(null);
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({ title: "Error", description: "Failed to update plan details.", variant: "destructive" });
    } finally {
      setIsPlanUpdating(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex min-h-screen bg-[#0F0F1A]">
        <AdminSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <h2 className="text-2xl font-bold">Member not found</h2>
          <Button variant="link" onClick={() => router.back()}>Go Back</Button>
        </main>
      </div>
    );
  }

  const handlePlanDownload = async (record: EditablePlanRecord) => {
    const payment = getPaymentForPlan(record);
    if (!payment) {
      toast({ title: "Not Found", description: "No invoice found for this plan.", variant: "destructive" });
      return;
    }
    await downloadInvoicePdf({ payment, member, gym: activeGym || undefined });
    toast({ title: "Downloaded", description: "Invoice PDF downloaded.", toast: undefined });
  };

  const handlePlanEmail = async (record: EditablePlanRecord) => {
    if (!member.email) {
      toast({ title: "No Email", description: "Member has no email address.", variant: "destructive", toast: undefined });
      return;
    }
    const payment = getPaymentForPlan(record);
    if (!payment) {
      toast({ title: "Not Found", description: "No invoice found for this plan.", variant: "destructive" });
      return;
    }

    const planId = `${record.startDate}-${record.planType}`;
    setEmailingPlanId(planId);
    try {
      const pdfBase64 = await getInvoicePdfBase64({ payment, member, gym: activeGym || undefined });
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          gymId,
          email: member.email, 
          memberName: member.fullName, 
          invoiceId: payment.invoiceId || payment.id, 
          pdfBase64,
          phone: member.phone,
          amount: payment.amount,
          planType: payment.planType,
          withGst: payment.withGst
        })
      });
      if (!res.ok) throw new Error("Failed to send email");
      toast({ title: "Email Sent", description: `Invoice sent to ${member.email}`, toast: undefined });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive", toast: undefined });
    } finally {
      setEmailingPlanId(null);
    }
  };

  const currentHistoryIndex = (member.planHistory || []).findIndex(
    plan => plan.startDate === member.membershipStartDate && plan.endDate === member.membershipEndDate
  );

  const currentMemberEntry: EditablePlanRecord = {
    planType: member.membershipType,
    startDate: member.membershipStartDate,
    endDate: member.membershipEndDate,
    amountPaid: member.feesPaid || 0,
    trainingType: member.trainingType || "general",
    personalTrainerId: member.trainingType === "personal" ? member.personalTrainerId || null : null,
    isCurrent: true,
    paymentSplits: member.paymentSplits || [],
    installments: member.installments || [],
    offerType: member.offerType || "",
    offerRemark: member.offerRemark,
    discountValue: member.discountValue,
    discountType: member.discountType || "amount",
    basePrice: member.basePrice,
    ptGymFee: member.ptGymFee,
    withGst: member.withGst,
  };

  const historyPlans: EditablePlanRecord[] = (member.planHistory || []).map((plan, historyIndex) => ({
    planType: plan.planType,
    startDate: plan.startDate,
    endDate: plan.endDate,
    amountPaid: plan.amountPaid || 0,
    trainingType: plan.trainingType || "general",
    personalTrainerId: plan.trainingType === "personal" ? (plan.personalTrainerId ?? null) : null,
    historyIndex,
    isCurrent: historyIndex === currentHistoryIndex,
    paymentSplits: plan.paymentSplits || [],
    installments: plan.installments || [],
    offerType: plan.offerType || (historyIndex === currentHistoryIndex ? member.offerType || "" : ""),
    offerRemark: plan.offerRemark || (historyIndex === currentHistoryIndex ? member.offerRemark : undefined),
    discountValue: plan.discountValue || (historyIndex === currentHistoryIndex ? member.discountValue : undefined),
    discountType: (plan as any).discountType || (historyIndex === currentHistoryIndex ? member.discountType || "amount" : "amount"),
    basePrice: (plan as any).basePrice ?? (historyIndex === currentHistoryIndex ? member.basePrice : undefined),
    ptGymFee: plan.ptGymFee,
    withGst: plan.withGst ?? (historyIndex === currentHistoryIndex ? !!member.withGst : false),
  }));

  const allPlans = [...historyPlans];
  if (currentHistoryIndex === -1) {
    allPlans.push(currentMemberEntry);
  }

  const dedupedPlans = Array.from(
    new Map(
      allPlans
        .filter(plan => plan.startDate && plan.endDate)
        .map(plan => [`${plan.planType}|${plan.startDate}|${plan.endDate}`, plan])
    ).values()
  ).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

  const localToday = new Date();
  localToday.setHours(0, 0, 0, 0);

  const getDayValue = (d: string) => new Date(d).setHours(0, 0, 0, 0);

  const upcomingPlans = dedupedPlans.filter(p => getDayValue(p.startDate) > localToday.getTime());
  const currentPlans = dedupedPlans.filter(p => getDayValue(p.startDate) <= localToday.getTime() && getDayValue(p.endDate) >= localToday.getTime());
  const displayCurrentPlan = currentPlans.length > 0 ? currentPlans[0] : null;
  const pastPlans = dedupedPlans.filter(p => p !== displayCurrentPlan && !upcomingPlans.includes(p));

  const activeTrainingType = displayCurrentPlan?.trainingType || member.trainingType || "general";
  const activeTrainerId = activeTrainingType === "personal"
    ? (displayCurrentPlan?.personalTrainerId || member.personalTrainerId || "")
    : "";
  const trainerForDisplay = activeTrainerId
    ? (gymTrainers.find(t => t.staffId === activeTrainerId) || (assignedTrainer && assignedTrainer.staffId === activeTrainerId ? assignedTrainer : null))
    : null;

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-4 mb-8 pt-12 lg:pt-0 border-b border-muted/20 pb-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.back()}
              className="hover:bg-[#1C1C1E] text-white"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Member Profile</h1>
              <p className="text-muted-foreground text-sm">View details, plan history, and edit profile</p>
            </div>
          </div>
          {!isFrontDesk && (
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={() => setShowDeleteDialog(true)} 
              disabled={isUpdating}
              className="flex-shrink-0"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Member
            </Button>
          )}
        </div>

        {/* Profile Card mirroring staff page */}
        <div className="max-w-4xl mx-auto rounded-xl bg-[#1A1A2E]/80 border border-white/[0.08] overflow-hidden shadow-lg mb-8 backdrop-blur-sm">
          {/* Header Section */}
          <div className="p-8 flex flex-col items-center justify-center border-b border-muted/20 relative">
            <div className="absolute top-4 right-4 flex items-center gap-2">
              {((member.planHistory || []).some(p => p.planType !== 'trial') || member.membershipType === 'trial') && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-emerald-500 hover:bg-emerald-500/10" 
                  title="Send Form Copy (WhatsApp)" 
                  onClick={handleSendFormCopy}
                  disabled={isSendingWhatsApp}
                >
                  {isSendingWhatsApp ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                </Button>
              )}
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-[#B6916D]/10 hover:text-[#B6916D]" title="Edit Profile" onClick={() => setEditProfileOpen(true)}>
                <Edit className="h-4 w-4" />
              </Button>
              <RenewMembershipPopover
                member={member}
                onUpdate={() => window.location.reload()}
                triggerElement={
                  <Button variant="ghost" size="icon" className="text-[#B6916D] hover:bg-[#B6916D]/10" title="Renew Plan">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                }
              />
            </div>
            
            <div className="relative group mb-4">
              <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-[#131313] shadow-md bg-muted/30 flex items-center justify-center">
                {member.photoUrl ? (
                  <img src={member.photoUrl} alt={member.fullName} className="h-full w-full object-cover" />
                ) : (
                  <User className="h-12 w-12 text-muted-foreground/40" />
                )}
              </div>
              {isPhotoUpdating && (
                <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#B6916D]" />
                </div>
              )}
              <label 
                htmlFor="photo-update" 
                className="absolute bottom-0 right-0 bg-[#B6916D] text-white p-2 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform"
              >
                <Camera className="h-4 w-4" />
                <input id="photo-update" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpdate} disabled={isPhotoUpdating} />
              </label>
            </div>
            
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-2xl font-bold">{member.fullName}</h2>
              {member.nickname && <span className="text-xl text-muted-foreground capitalize">({member.nickname})</span>}
            </div>
            <p className="text-xs text-muted-foreground mb-3 font-mono">ID: {member.memberId}</p>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
              new Date(member.membershipEndDate) > new Date() 
                ? "bg-emerald-500/20 text-emerald-400" 
                : "bg-destructive/10 text-destructive"
            }`}>
              {new Date(member.membershipEndDate) > new Date() ? "Active" : "Expired"}
            </span>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-3 divide-x divide-muted/20 border-b border-muted/20 bg-[#131313]/30">
            <div className="p-4 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-[#B6916D]">
                ₹{dedupedPlans.reduce((s, p) => s + (p.amountPaid || 0), 0).toLocaleString()}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Total Fees Paid</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-bold text-foreground">
                {format(new Date(dedupedPlans[dedupedPlans.length - 1]?.startDate || member.membershipStartDate), "PP")}
              </span>
              <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Joined</span>
            </div>
            <div className="p-4 flex flex-col items-center justify-center text-center">
              <span className="text-sm font-bold text-foreground">{format(new Date(member.membershipEndDate), "PP")}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Expiry Date</span>
            </div>
          </div>

          <div className="bg-[#B6916D]/10 px-6 py-2 border-b border-muted/10 flex items-center justify-between">
            <span className="text-[10px] font-bold text-[#8888A0] uppercase tracking-widest">Membership Profile</span>
            <div className="flex items-center gap-4">
               <div className="flex items-center gap-1.5">
                  {activeTrainingType === "personal" ? (
                    <div className="flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2.5 py-1 rounded-md border border-purple-500/20">
                      <Zap className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Personal Training</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md border border-blue-500/20">
                      <User className="h-3 w-3" />
                      <span className="text-[10px] font-bold uppercase tracking-wider">General Training</span>
                    </div>
                  )}
                </div>
                <div className="h-4 w-px bg-white/10" />
                <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{member.membershipType} Plan</span>
              </div>
            </div>

            {/* Details Section */}
            <div className="p-6 space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Left Column: Contact & Health */}
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{member.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{member.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className={member.address ? "text-foreground" : "text-muted-foreground"}>
                        {member.address || "No address provided."}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Health & Fitness</h3>
                  <div className="space-y-4 bg-[#131313] p-5 rounded-lg border border-muted/20">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Fitness Goal</span>
                      <p className="text-sm font-medium">{member.fitnessGoals || "None specified"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Health Assessment</span>
                      <p className="text-sm font-medium whitespace-pre-wrap">{member.healthAssessment || "No ongoing conditions"}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Taking Medication</span>
                      <p className="text-sm font-medium">{member.isTakingMedication || "No"}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Personal & Offer Details</h3>
                  <div className="space-y-4 bg-[#131313] p-5 rounded-lg border border-muted/20">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Blood Group</span>
                        <p className="text-sm font-medium">{member.bloodGroup || "Not specified"}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Profession</span>
                        <p className="text-sm font-medium">{member.profession || "Not specified"}</p>
                      </div>
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Offer Type</span>
                        <p className="text-sm font-medium capitalize">{member.offerType || "No Offer"}</p>
                      </div>
                      {member.offerType && (
                        <div className="space-y-1 col-span-2 border-t border-white/5 pt-2">
                          <span className="text-xs text-muted-foreground">Offer Remark</span>
                          <p className="text-sm font-medium italic text-[#B6916D]">"{member.offerRemark || "N/A"}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Personal Trainer */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Personal Trainer</h3>
                  {activeTrainingType === "personal" ? (
                    trainerForDisplay ? (
                      <div
                        className="bg-emerald-500/5 p-4 rounded-lg border border-emerald-500/20 flex items-center gap-4 cursor-pointer hover:border-emerald-500/40 transition-colors"
                        onClick={() => router.push(`/admin/staff/${trainerForDisplay.staffId}`)}
                      >
                        <div className="h-10 w-10 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                          {trainerForDisplay.photoUrl ? (
                            <img src={trainerForDisplay.photoUrl} alt={trainerForDisplay.fullName} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center bg-[#B6916D]/20 text-[#B6916D] text-xs font-bold">
                              {trainerForDisplay.fullName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-[#B6916D]">{trainerForDisplay.fullName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{trainerForDisplay.staffId}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[#131313] p-4 rounded-lg border border-muted/20 border-dashed text-center">
                        <p className="text-sm text-muted-foreground">Personal training active but no trainer assigned</p>
                      </div>
                    )
                  ) : (
                    <div className="bg-[#131313] p-4 rounded-lg border border-muted/20 border-dashed text-center">
                      <p className="text-sm text-muted-foreground">General training active. Opt for Personal Training to allot a trainer.</p>
                    </div>
                  )}
                </div>

                {/* Family & Friends Section */}
                <div className="pt-2 border-t border-muted/20 pb-4">
                  <div className="flex items-center gap-2 mb-4">
                    <User className="h-4 w-4 text-[#B6916D]" />
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Family & Friends</h3>
                  </div>
                  {isLoadingFamily ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading family...
                    </div>
                  ) : familyData.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {familyData.map((m) => (
                        <button
                          key={m.memberId}
                          onClick={() => router.push(`/admin/member/${m.memberId}`)}
                          className="flex flex-col items-center p-3 rounded-xl bg-[#131313] border border-muted/10 hover:border-[#B6916D]/30 transition-all hover:bg-[#1A1A2E] group"
                        >
                          <div className="h-12 w-12 rounded-full overflow-hidden bg-muted/20 mb-2 border-2 border-transparent group-hover:border-[#B6916D]/50 transition-all">
                            {m.photoUrl ? (
                              <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center bg-muted/30 text-muted-foreground">
                                <User className="h-6 w-6" />
                              </div>
                            )}
                          </div>
                          <p className="text-[11px] font-bold text-foreground text-center line-clamp-1">{m.fullName}</p>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-tighter">View Profile</p>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-[#131313]/50 p-4 rounded-lg border border-muted/20 border-dashed text-center">
                      <p className="text-xs text-muted-foreground italic">No family or friends linked. Edit profile or renew to link them.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Active Plan Details */}
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Active Plan</h3>
                  {displayCurrentPlan ? (
                    <button
                      type="button"
                      onClick={() => openPlanEditor(displayCurrentPlan)}
                      className="w-full text-left bg-emerald-500/5 p-5 rounded-lg border border-emerald-500/10 space-y-2 transition hover:border-emerald-500/30 hover:bg-emerald-500/10"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-[#B6916D] uppercase tracking-wider text-xs">{displayCurrentPlan.planType} Plan</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          Active
                        </span>
                      </div>
                      <div className="text-lg font-bold text-emerald-400">
                        ₹{displayCurrentPlan.amountPaid?.toLocaleString() || 0}
                        <span className="text-[10px] text-muted-foreground ml-1 font-normal uppercase">Paid</span>
                        {(displayCurrentPlan.offerType || member.offerType) && (
                          <div className="mt-1 flex flex-col gap-0.5">
                            <span className="text-[10px] text-[#B6916D] font-bold uppercase tracking-wider">
                              Offer: {displayCurrentPlan.offerType || member.offerType} 
                              {displayCurrentPlan.discountValue || member.discountValue ? ` (${displayCurrentPlan.discountValue || member.discountValue} Off)` : ""}
                            </span>
                            {(displayCurrentPlan.offerRemark || member.offerRemark) && (
                              <p className="text-[10px] text-[#8888A0] italic lowercase line-clamp-1">
                                {displayCurrentPlan.offerRemark || member.offerRemark}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-xs text-[#8888A0] font-medium">
                          {format(new Date(displayCurrentPlan.startDate), "PP")} - {format(new Date(displayCurrentPlan.endDate), "PP")}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={(event) => {
                            event.stopPropagation();
                            handlePlanDownload(displayCurrentPlan);
                          }} title="Download Invoice">
                            <Download className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10" onClick={(event) => {
                            event.stopPropagation();
                            handlePlanEmail(displayCurrentPlan);
                          }} title="Email Invoice" disabled={emailingPlanId === `${displayCurrentPlan.startDate}-${displayCurrentPlan.planType}`}>
                            {emailingPlanId === `${displayCurrentPlan.startDate}-${displayCurrentPlan.planType}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>
                    </button>
                  ) : (
                    <div className="bg-red-500/5 p-5 rounded-lg border border-red-500/10 space-y-2 text-center py-8">
                      <p className="text-xs text-red-400 font-bold uppercase tracking-widest">No current plan</p>
                      <p className="text-[11px] text-[#8888A0]">The membership has expired.</p>
                    </div>
                  )}
                </div>

                {upcomingPlans.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Upcoming Plan</h3>
                    <div className="space-y-3">
                      {upcomingPlans.map((record, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openPlanEditor(record)}
                          className="w-full text-left bg-[#1C1C1E] p-4 rounded-lg border border-amber-500/20 transition hover:border-amber-500/40 hover:bg-[#232326]"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <p className="font-medium text-sm text-amber-500 capitalize">{record.planType}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(record.startDate), "MMM d, yyyy")} to {format(new Date(record.endDate), "MMM d, yyyy")}
                              </p>
                              {/* Training type badge for upcoming plan */}
                              {record.trainingType && (
                                <div className="mt-2">
                                  {record.trainingType === "personal" ? (
                                    <div className="inline-flex items-center gap-1 text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-purple-500/20">
                                      <Zap className="h-2.5 w-2.5" />
                                      Personal Training
                                    </div>
                                  ) : (
                                    <div className="inline-flex items-center gap-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                                      <User className="h-2.5 w-2.5" />
                                      General Training
                                    </div>
                                  )}
                                </div>
                              )}
                              {record.offerType && (
                                <div className="mt-2 flex flex-col gap-0.5">
                                  <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">
                                    Offer: {record.offerType} {record.discountValue ? `(${record.discountValue} Off)` : ""}
                                  </span>
                                  {record.offerRemark && (
                                    <p className="text-[10px] text-muted-foreground italic lowercase line-clamp-1">
                                      {record.offerRemark}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <div className="flex justify-end items-center gap-2 mb-1">
                                <p className="font-semibold text-foreground">₹{(record.amountPaid || 0).toLocaleString()}</p>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 -mr-2" onClick={(event) => {
                                  event.stopPropagation();
                                  handlePlanDownload(record);
                                }} title="Download Invoice">
                                  <Download className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-6 w-6 text-amber-500 hover:text-amber-400 hover:bg-amber-500/10 -mr-2" onClick={(event) => {
                                  event.stopPropagation();
                                  handlePlanEmail(record);
                                }} title="Email Invoice" disabled={emailingPlanId === `${record.startDate}-${record.planType}`}>
                                  {emailingPlanId === `${record.startDate}-${record.planType}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                                </Button>
                              </div>
                              <p className="text-[10px] text-muted-foreground uppercase text-right">Advance Payment</p>
                            </div>
                          </div>
                        </button>
                      ))}
                      </div>
                  </div>
                )}



                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Plan History</h3>
                  {pastPlans.length > 0 ? (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                      {pastPlans.map((record, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => openPlanEditor(record)}
                          className="w-full text-left bg-[#131313] p-4 rounded-lg border border-muted/20 flex justify-between items-center gap-4 transition hover:border-white/20 hover:bg-[#181818]"
                        >
                          <div>
                            <p className="font-medium text-sm text-muted-foreground capitalize">{record.planType}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(record.startDate), "MMM d, yyyy")} to {format(new Date(record.endDate), "MMM d, yyyy")}
                            </p>
                            {record.offerType && (
                              <div className="mt-1 flex flex-col gap-0.5">
                                <span className="text-[9px] text-[#B6916D] font-bold uppercase tracking-wider">
                                  Offer: {record.offerType} {record.discountValue ? `(${record.discountValue} Off)` : ""}
                                </span>
                                {record.offerRemark && (
                                  <p className="text-[9px] text-muted-foreground/60 italic lowercase line-clamp-1">
                                    {record.offerRemark}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="flex justify-end items-center gap-2 mb-1">
                              <p className="font-semibold text-muted-foreground">₹{record.amountPaid}</p>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/10 -mr-2" onClick={(event) => {
                                event.stopPropagation();
                                handlePlanDownload(record);
                              }} title="Download Invoice">
                                <Download className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white hover:bg-white/10 -mr-2" onClick={(event) => {
                                event.stopPropagation();
                                handlePlanEmail(record);
                              }} title="Email Invoice" disabled={emailingPlanId === `${record.startDate}-${record.planType}`}>
                                {emailingPlanId === `${record.startDate}-${record.planType}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                              </Button>
                            </div>
                            <p className="text-[10px] text-muted-foreground uppercase text-right">Fees</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-muted-foreground bg-[#131313] rounded-lg border border-muted/20 border-dashed">
                      <p className="text-sm">No past membership records found.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Notes Section */}
            <div className="mt-8 border-t border-muted/20 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-4 w-4 text-[#B6916D]" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Admin Notes</h3>
              </div>
              <div className="bg-[#131313]/50 p-6 rounded-xl border border-muted/10 min-h-[100px] relative overflow-hidden mb-6">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#B6916D]/30"></div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed italic">
                  {member.notes || "No additional notes for this member."}
                </p>
              </div>

              {member.notesHistory && member.notesHistory.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Previous Notes History</h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {member.notesHistory.map((history, idx) => (
                      <div key={idx} className="bg-[#131313]/30 p-4 rounded-lg border border-muted/10 relative">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {format(new Date(history.date), "MMM d, yyyy • hh:mm a")}
                          </span>
                          <button
                            onClick={() => handleDeleteNote(idx)}
                            className="text-red-400/60 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                            title="Delete this note"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                        <p className="text-xs text-muted-foreground italic whitespace-pre-wrap">
                          {history.note || "(Empty Note)"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

      <Dialog open={planEditorOpen} onOpenChange={setPlanEditorOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">Edit Plan</DialogTitle>
            <DialogDescription className="text-[#8888A0]">
              Update plan dates, duration label, paid amount, and training type without creating a duplicate plan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan Type</Label>
                <select
                  value={planForm.planType}
                  onChange={(event) => {
                    const nextPlanType = event.target.value;
                    setPlanForm(prev => ({
                      ...prev,
                      planType: nextPlanType,
                      endDate: syncPlanEndDate(prev.startDate, nextPlanType) || prev.endDate,
                    }));
                  }}
                  className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                >
                  {PLAN_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  min="0"
                  value={planForm.amountPaid}
                  onChange={(event) => setPlanForm(prev => ({ ...prev, amountPaid: event.target.value }))}
                  className="bg-[#131313] border-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={planForm.startDate}
                  onChange={(event) => {
                    const nextStartDate = event.target.value;
                    setPlanForm(prev => ({
                      ...prev,
                      startDate: nextStartDate,
                      endDate: syncPlanEndDate(nextStartDate, prev.planType) || prev.endDate,
                    }));
                  }}
                  className="bg-[#131313] border-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={planForm.endDate}
                  onChange={(event) => setPlanForm(prev => ({ ...prev, endDate: event.target.value }))}
                  className="bg-[#131313] border-muted/20"
                />
              </div>

              <div className="space-y-2">
                <Label>Training Type</Label>
                <select
                  value={planForm.trainingType}
                  onChange={(event) => setPlanForm(prev => ({
                    ...prev,
                    trainingType: event.target.value as "general" | "personal",
                    personalTrainerId: event.target.value === "personal" ? prev.personalTrainerId : "",
                  }))}
                  className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                >
                  <option value="general">General Training</option>
                  <option value="personal">Personal Training</option>
                </select>
              </div>

              <div className="space-y-2 sm:col-span-2 pt-4 border-t border-white/[0.04]">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Standard Fee (Base Price) (₹) <span className="text-red-500">*</span></Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2200"
                      value={planForm.basePrice}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, basePrice: e.target.value }))}
                      className="bg-[#131313] border-muted/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Offer Type</Label>
                    <select
                      value={planForm.offerType}
                      onChange={(e) => setPlanForm(prev => ({ ...prev, offerType: e.target.value }))}
                      className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                    >
                      <option value="">No Offer</option>
                      <option value="Student">Student</option>
                      <option value="Couple">Couple</option>
                      <option value="Combo">Combo</option>
                      <option value="Individual">Individual</option>
                      <option value="Group">Group</option>
                    </select>
                  </div>

                  {planForm.offerType && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Discount Type</Label>
                        <select
                          value={planForm.discountType}
                          onChange={(e) => setPlanForm(prev => ({ ...prev, discountType: e.target.value as any }))}
                          className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                        >
                          <option value="amount">Fixed Amount (₹)</option>
                          <option value="percentage">Percentage (%)</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Discount Value</Label>
                        <Input
                          type="number"
                          placeholder={planForm.discountType === "percentage" ? "e.g. 10" : "e.g. 500"}
                          value={planForm.discountValue}
                          onChange={(e) => setPlanForm(prev => ({ ...prev, discountValue: e.target.value }))}
                          className="bg-[#131313] border-muted/20"
                        />
                      </div>
                      <div className="space-y-2 sm:col-span-2">
                        <Label className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Offer Remark</Label>
                        <textarea
                          placeholder="e.g. Student discount applied"
                          value={planForm.offerRemark}
                          onChange={(e) => setPlanForm(prev => ({ ...prev, offerRemark: e.target.value }))}
                          className="w-full min-h-[60px] p-2 text-xs bg-[#131313] border border-muted/20 text-white focus:border-[#B6916D]/50 rounded-md focus:outline-none"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* ── Financial Summary ── */}
              <div className="sm:col-span-2 space-y-3 px-4 py-3 bg-white/[0.02] border border-white/[0.06] rounded-lg">
                <h4 className="text-[11px] font-bold text-[#B6916D] uppercase tracking-wider border-b border-white/[0.06] pb-1.5">Membership Cost Breakdown</h4>
                
                {/* Standard Fee */}
                <div className="flex justify-between text-[11px]">
                  <span className="text-[#8888A0]">Standard Fee (Base Price):</span>
                  <span className="text-white font-medium">₹{(Number(planForm.basePrice) || 0).toLocaleString()}</span>
                </div>

                {/* Offer Details */}
                {planForm.offerType ? (
                  <>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#8888A0]">Offer Type:</span>
                      <span className="text-white font-medium">{planForm.offerType}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#8888A0]">Discount Type:</span>
                      <span className="text-white font-medium">{planForm.discountType === "percentage" ? "Percentage (%)" : "Fixed Amount (₹)"}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-[#8888A0]">Discount Value:</span>
                      <span className="text-red-400 font-medium">
                        {planForm.discountType === "percentage" ? `${planForm.discountValue}%` : `₹${(Number(planForm.discountValue) || 0).toLocaleString()}`}
                        {" "}
                        <span className="text-[#8888A0]">
                          (-₹{(planForm.discountType === "percentage"
                            ? Math.round((Number(planForm.basePrice) * Number(planForm.discountValue)) / 100)
                            : Number(planForm.discountValue) || 0
                          ).toLocaleString()})
                        </span>
                      </span>
                    </div>
                    {planForm.offerRemark && (
                      <div className="flex justify-between text-[11px]">
                        <span className="text-[#8888A0]">Offer Remark:</span>
                        <span className="text-white/60 font-medium italic text-right max-w-[60%]">{planForm.offerRemark}</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#8888A0]">Discount:</span>
                    <span className="text-white/40 font-medium">No offer applied</span>
                  </div>
                )}

                {/* Calculated Payable */}
                <div className="flex justify-between text-[12px] font-bold border-t border-white/[0.06] pt-2 mt-1">
                  <span className="text-[#B6916D]">Calculated Payable:</span>
                  <span className="text-[#B6916D]">₹{calculatedFinalFee.toLocaleString()}</span>
                </div>

                {/* Payment Collection Status */}
                <div className="border-t border-white/[0.06] pt-2 mt-1 space-y-2">
                  <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Payment Collection Status</h4>
                  
                  {/* Upfront */}
                  <div className="flex justify-between text-[11px]">
                    <span className="text-[#8888A0]">💰 Paid Upfront (Membership Day):</span>
                    <span className="text-white font-medium">₹{(Number(planForm.amountPaid) || 0).toLocaleString()}</span>
                  </div>
                  
                  {/* Installment Breakdown */}
                  {planInstallments.length > 0 && (
                    <>
                      {planInstallments.filter(i => i.status === "paid").length > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8888A0]">✅ Installments Paid ({planInstallments.filter(i => i.status === "paid").length}):</span>
                          <span className="text-emerald-400 font-medium">₹{planInstallments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                        </div>
                      )}
                      {planInstallments.filter(i => i.status === "pending").length > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8888A0]">⏳ Installments Remaining ({planInstallments.filter(i => i.status === "pending").length}):</span>
                          <span className="text-amber-400 font-medium">₹{planInstallments.filter(i => i.status === "pending").reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                        </div>
                      )}
                      {planInstallments.filter(i => i.status === "archived").length > 0 && (
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[#8888A0]">📦 Installments Archived ({planInstallments.filter(i => i.status === "archived").length}):</span>
                          <span className="text-white/30 font-medium">₹{planInstallments.filter(i => i.status === "archived").reduce((s, i) => s + i.amount, 0).toLocaleString()}</span>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Total Collected */}
                  <div className="flex justify-between text-[12px] font-bold border-t border-dashed border-white/[0.08] pt-1.5 mt-1">
                    <span className="text-white">Total Collected Till Date:</span>
                    <span className={`font-bold ${
                      (Number(planForm.amountPaid) || 0) + planInstallments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0) >= calculatedFinalFee
                        ? "text-emerald-400"
                        : "text-amber-400"
                    }`}>
                      ₹{((Number(planForm.amountPaid) || 0) + planInstallments.filter(i => i.status === "paid").reduce((s, i) => s + i.amount, 0)).toLocaleString()}
                      <span className="text-[#8888A0] text-[10px] font-normal ml-1">/ ₹{calculatedFinalFee.toLocaleString()}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 sm:col-span-2 py-4 bg-[#B6916D]/5 px-4 rounded-lg border border-[#B6916D]/20">
                <Label className="text-[#B6916D] font-bold">Paid Today / Upfront (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={planForm.amountPaid}
                  onChange={(event) => setPlanForm(prev => ({ ...prev, amountPaid: event.target.value }))}
                  className="bg-[#131313] border-[#B6916D]/30 text-lg font-bold text-[#B6916D]"
                />
              </div>

              {planForm.trainingType === "personal" && (
                <>
                  <div className="space-y-2">
                    <Label>Trainer</Label>
                    <select
                      value={planForm.personalTrainerId}
                      onChange={(event) => setPlanForm(prev => ({ ...prev, personalTrainerId: event.target.value }))}
                      className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                    >
                      <option value="">Choose a trainer...</option>
                      {gymTrainers.map((trainer) => (
                        <option key={trainer.staffId} value={trainer.staffId}>
                          {trainer.fullName} ({trainer.staffId})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Base Gym Fee (per month)</Label>
                    <Input
                      type="number"
                      value={planForm.ptGymFee}
                      onChange={(event) => setPlanForm(prev => ({ ...prev, ptGymFee: event.target.value }))}
                      className="bg-[#131313] border-muted/20"
                    />
                    <p className="text-[10px] text-[#8888A0] italic">Deducted from PT fee for gym share.</p>
                  </div>
                </>
              )}

              <div className="pt-2 sm:col-span-2">
                <PaymentSplitter 
                  recipients={activeGym?.paymentRecipients || []}
                  initialTotal={Number(planForm.amountPaid) || 0}
                  initialSplits={planPaymentSplits}
                  onChange={setPlanPaymentSplits}
                />
              </div>

              <div className="pt-2 sm:col-span-2">
                <InstallmentManager 
                  installments={planInstallments}
                  onChange={setPlanInstallments}
                  payableAmount={calculatedFinalFee}
                  paidAmount={Number(planForm.amountPaid) || 0}
                />
              </div>

              <div className="flex flex-col gap-1 pt-2 sm:col-span-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="plan-with-gst"
                    checked={planForm.withGst}
                    onChange={(e) => setPlanForm(prev => ({ ...prev, withGst: e.target.checked }))}
                    disabled={activeGym?.gstStatus !== 'validated'}
                    className="w-4 h-4 rounded border-muted/20 bg-[#131313] text-[#B6916D] focus:ring-[#B6916D] disabled:opacity-50"
                  />
                  <Label htmlFor="plan-with-gst" className={`text-sm cursor-pointer ${activeGym?.gstStatus !== 'validated' ? 'text-[#8888A0]/50' : 'text-[#8888A0]'}`}>Include GST (5% deduction from trainer's share)</Label>
                </div>
                {activeGym?.gstStatus !== 'validated' && (
                  <p className="text-[10px] text-amber-500/80 ml-6 italic">
                    GST verification required in Settings.
                  </p>
                )}
              </div>
              </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-muted/20">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPlanEditorOpen(false)}
                className="border-muted/20 hover:bg-[#1C1C1E]"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handlePlanUpdate}
                disabled={
                  isPlanUpdating || 
                  (planPaymentSplits.reduce((sum, s) => sum + (Number(s.amount) || 0), 0) !== (Number(planForm.amountPaid) || 0)) ||
                  planPaymentSplits.some(s => !s.receivedBy) ||
                  ((Number(planForm.amountPaid) || 0) + planInstallments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0) !== calculatedFinalFee)
                }
                className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white"
              >
                {isPlanUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Plan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-white font-bold">Edit Profile</DialogTitle>
            <DialogDescription className="text-[#8888A0]">
              Update member details. Plan dates, duration, fees, and training type can be edited from the plan cards.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdate)} className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl><Input className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nickname"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nickname</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" {...field} placeholder="Add a nickname" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone Number</FormLabel>
                      <FormControl><Input className="bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/50" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={field.onChange}
                          className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer-not-to-say">Prefer not to say</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="healthAssessment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Health Assessment</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bloodGroup"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Blood Group</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" {...field} placeholder="e.g. O+" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="profession"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Profession</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" {...field} placeholder="e.g. Software Engineer" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fitnessGoals"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fitness Goal</FormLabel>
                      <FormControl><Input className="bg-[#131313] border-muted/20" {...field} placeholder="e.g. Weight Loss" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isTakingMedication"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Taking Medication?</FormLabel>
                      <FormControl>
                        <select
                          value={field.value || "no"}
                          onChange={field.onChange}
                          className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                        >
                          <option value="no">No</option>
                          <option value="yes">Yes</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="offerType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Offer Type</FormLabel>
                      <FormControl>
                        <select
                          value={field.value || ""}
                          onChange={field.onChange}
                          className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                        >
                          <option value="">No Offer</option>
                          <option value="Student">Student</option>
                          <option value="Couple">Couple</option>
                          <option value="Combo">Combo</option>
                          <option value="Individual">Individual</option>
                          <option value="Group">Group</option>
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("offerType") && (
                  <>
                    <FormField
                      control={form.control}
                      name="discountValue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Discount Given</FormLabel>
                          <FormControl>
                            <Input className="bg-[#131313] border-muted/20" {...field} placeholder="e.g. 10% or Rs. 500" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="offerRemark"
                      render={({ field }) => (
                        <FormItem className="sm:col-span-2">
                          <FormLabel>Offer Remark</FormLabel>
                          <FormControl>
                            <textarea 
                              className="w-full min-h-[80px] p-3 rounded-md bg-[#131313] border border-muted/20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-muted-foreground/30"
                              placeholder="e.g. Family package discount applied for 3 members"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}
              </div>

              <div className="pt-2 border-t border-muted/20">
                {gymId && member && (
                   <FamilyManager 
                     currentFamilyIds={member.familyMemberIds || []}
                     onAdd={onAddFamily}
                     onRemove={onRemoveFamily}
                     gymId={gymId}
                     excludeMemberId={member.memberId}
                   />
                )}
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Admin Notes</FormLabel>
                    <FormControl>
                      <textarea 
                        className="w-full min-h-[120px] p-3 rounded-md bg-[#131313] border border-muted/20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-muted-foreground/30"
                        placeholder="Add private notes about this member (e.g., special requirements, payment history details, etc.)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="withGst"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-1 p-4 rounded-md border border-white/[0.08] bg-white/[0.02]">
                    <div className="flex flex-row items-center space-x-3 space-y-0">
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          disabled={activeGym?.gstStatus !== 'validated'}
                          className="w-4 h-4 rounded border-muted/20 bg-[#131313] text-[#B6916D] focus:ring-[#B6916D] disabled:opacity-50"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className={`text-sm font-medium cursor-pointer ${activeGym?.gstStatus !== 'validated' ? 'text-foreground/50' : 'text-foreground'}`}>Generate GST Invoices</FormLabel>
                        <p className="text-[10px] text-muted-foreground italic">Enabling this will deduct 5% GST from personal trainer's commission shared for this member.</p>
                      </div>
                    </div>
                    {activeGym?.gstStatus !== 'validated' && (
                      <p className="text-[10px] text-amber-500/80 ml-7 italic">
                        GST verification required in Settings.
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <div className="flex justify-end pt-4 border-t border-muted/20 sm:col-span-2">
                <Button type="submit" disabled={isUpdating} className="w-full sm:w-auto bg-[#B6916D] hover:bg-[#B6916D]/90 text-white">
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      {!isFrontDesk && (
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="sm:max-w-md bg-[#1C1C1E] border-muted/20">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Delete Member
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete <strong>{member.fullName}</strong>? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowDeleteDialog(false)} disabled={isUpdating} className="w-full sm:w-auto border-muted/20 hover:bg-[#2C2C2E]">
                Cancel
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={isUpdating} className="w-full sm:w-auto">
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      </main>
    </div>
  );
}
