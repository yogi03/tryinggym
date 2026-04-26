"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, query, doc, setDoc, onSnapshot, getDocs, where, addDoc, limit } from "firebase/firestore";
import { Member, Staff } from "@/types";
import AdminSidebar from "@/components/admin/Sidebar";
import MemberTable from "@/components/admin/MemberTable";
import { Loader2, Search, FilterX, IndianRupee, UserPlus, Plus, Filter, ChevronDown, ListChecks, Download, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import AddMemberDialog from "@/components/admin/dashboard/AddMemberDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { generateMemberId } from "@/lib/member-id";




// Helper to calculate the apportioned amount for a recipient (handles legacy joined strings)
const getAllocatedAmount = (p: any, filterValue: string) => {
  const amount = Number(p.amount) || 0;
  if (filterValue === "Recipient") return amount;
  const raw = p.receivedBy || "Unassigned";
  const isSplit = raw.includes(" / ") || (raw.includes("/") && raw.length > 3);
  if (isSplit) {
    const recipients = raw.split(/\s*\/\s*/).filter(Boolean);
    if (recipients.length > 1) return amount / recipients.length;
  }
  return amount;
};

export default function MembersPage() {
  const router = useRouter();
  const { adminData, activeGym, frontDeskData, loading: authLoading } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtering & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Status");
  const [genderFilter, setGenderFilter] = useState("Gender");
  const [joinedFilter, setJoinedFilter] = useState("Joined");
  const [medicationFilter, setMedicationFilter] = useState("Medication");
  const [feesFilter, setFeesFilter] = useState("Fees");
  const [recipientFilter, setRecipientFilter] = useState("Recipient");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [showFilterDialog, setShowFilterDialog] = useState(false);

  // Add Member Dialog State
  const [showAddDialog, setShowAddDialog] = useState(false);



  // Excel Export Logic
  const handleExport = () => {
    if (filteredMembers.length === 0) {
      toast({ title: "No Data", description: "There are no members to export." });
      return;
    }
    const exportData = filteredMembers.map(m => ({
      "Member ID": m.memberId,
      "Name": m.fullName,
      "Nickname": m.nickname || "",
      "Email": m.email,
      "Phone": m.phone,
      "Address": m.address || "",
      "Gender": m.gender,
      "DOB": m.dob || "",
      "Plan": m.membershipType,
      "Start Date": m.membershipStartDate ? new Date(m.membershipStartDate).toLocaleDateString() : "",
      "Renewal Date": m.membershipEndDate ? new Date(m.membershipEndDate).toLocaleDateString() : "",
      "Fees Paid": m.feesPaid || 0,
      "Medication": m.isTakingMedication,
      "Status": new Date(m.membershipEndDate) >= new Date() ? "Active" : "Expired"
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Members");
    XLSX.writeFile(wb, "GymManagr_Members_Export.xlsx");
  };

  useEffect(() => {
    if (!gymId) return;

    setLoading(true);
    let unsubMembers: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let unsubStaff: (() => void) | undefined;

    const setupListeners = () => {
      try {
        // 1. Members Listener
        unsubMembers = onSnapshot(collection(db, "gyms", gymId, "members"), (snapshot) => {
          setMembers(snapshot.docs.map(doc => ({
            memberId: doc.id,
            ...doc.data()
          })) as Member[]);
          setLoading(false);
        });

        // 2. Payments Listener
        unsubPayments = onSnapshot(collection(db, "gyms", gymId, "payments"), (snapshot) => {
          setPayments(snapshot.docs.map(doc => doc.data()));
        });

        // 3. Staff Listener
        unsubStaff = onSnapshot(collection(db, "gyms", gymId, "staff"), (snapshot) => {
          setStaff(snapshot.docs.map(doc => ({ staffId: doc.id, ...doc.data() })) as Staff[]);
        });

      } catch (err) {
        console.error("Members listeners error:", err);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubMembers?.();
      unsubPayments?.();
      unsubStaff?.();
    };
  }, [gymId]);

  // Pre-calculate date ranges for fees filter to optimize and reuse
  const feesDateRange = useMemo(() => {
    if (feesFilter === "Fees") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    if (feesFilter === "today") return { start: today, end: endOfDay };
    if (feesFilter === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return { start: yesterday, end: yesterdayEnd };
    }
    if (feesFilter === "last7") {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: endOfDay };
    }
    if (feesFilter === "last30") {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start, end: endOfDay };
    }
    if (feesFilter === "last90") {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return { start, end: endOfDay };
    }
    if (feesFilter === "half_yearly") {
      const start = new Date(today);
      start.setDate(start.getDate() - 180);
      return { start, end: endOfDay };
    }
    if (feesFilter === "yearly") {
      const start = new Date(today);
      start.setDate(start.getDate() - 365);
      return { start, end: endOfDay };
    }
    if (feesFilter === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    return null;
  }, [feesFilter, customStartDate, customEndDate]);

  // Combined Filter Logic
  const filteredMembers = members.map(member => {
    let filteredFeesPaid = undefined;
    let hasPaymentInPeriod = false;

    if (feesDateRange) {
      const memberPayments = payments.filter(p => p.memberId === member.memberId);
      const paymentsInPeriod = memberPayments.filter(p => {
        const pDate = new Date(p.date);
        const inDateRange = feesDateRange ? (pDate >= feesDateRange.start && pDate <= feesDateRange.end) : true;
        const matchesRecipient = recipientFilter === "Recipient" || (p.receivedBy && p.receivedBy.toLowerCase().includes(recipientFilter.toLowerCase()));
        return inDateRange && matchesRecipient;
      });
      
      hasPaymentInPeriod = paymentsInPeriod.length > 0;
      filteredFeesPaid = paymentsInPeriod.reduce((sum, p) => sum + getAllocatedAmount(p, recipientFilter), 0);
    } else if (recipientFilter !== "Recipient") {
      const memberPayments = payments.filter(p => p.memberId === member.memberId);
      const paymentsByRecipient = memberPayments.filter(p => p.receivedBy && p.receivedBy.toLowerCase().includes(recipientFilter.toLowerCase()));
      hasPaymentInPeriod = paymentsByRecipient.length > 0;
      filteredFeesPaid = paymentsByRecipient.reduce((sum, p) => sum + getAllocatedAmount(p, recipientFilter), 0);
    }

    return { ...member, filteredFeesPaid, hasPaymentInPeriod };
  }).filter(member => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(member.membershipEndDate);
    expiryDate.setHours(0, 0, 0, 0);
    const startDate = new Date(member.membershipStartDate);

    // 1. Search Logic (Global Search)
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      member.fullName.toLowerCase().includes(searchLower) ||
      member.phone.toLowerCase().includes(searchLower) ||
      member.email.toLowerCase().includes(searchLower) ||
      member.address.toLowerCase().includes(searchLower) ||
      member.membershipType.toLowerCase().includes(searchLower) ||
      (member.nickname && member.nickname.toLowerCase().includes(searchLower)) ||
      (member.fitnessGoals && member.fitnessGoals.toLowerCase().includes(searchLower)) ||
      (member.healthAssessment && member.healthAssessment.toLowerCase().includes(searchLower));

    // 2. Status Logic
    let matchesStatus = true;
    const currentStatus = statusFilter.toLowerCase();
    if (currentStatus === "expiring") {
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      matchesStatus = diffDays >= 0 && diffDays <= 5;
    } else if (currentStatus === "expired") {
      matchesStatus = expiryDate < today;
    } else if (currentStatus === "active") {
      matchesStatus = expiryDate >= today;
    }

    // 3. Gender Logic
    const matchesGender = genderFilter === "Gender" || member.gender === genderFilter.toLowerCase();

    // 4. Joined Date Logic
    let matchesJoined = true;
    if (joinedFilter === "today") {
      matchesJoined = startDate.toDateString() === today.toDateString();
    } else if (joinedFilter === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      matchesJoined = startDate.toDateString() === yesterday.toDateString();
    } else if (joinedFilter === "last7") {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 7);
      matchesJoined = startDate >= cutoff;
    } else if (joinedFilter !== "Joined") {
      const months = parseInt(joinedFilter);
      const cutoffDate = new Date();
      cutoffDate.setMonth(cutoffDate.getMonth() - months);
      matchesJoined = startDate >= cutoffDate;
    }

    // 6. Medication Logic
    const matchesMedication = medicationFilter === "Medication" || member.isTakingMedication.toLowerCase() === (medicationFilter === "Medication: Yes" ? "yes" : "no");

    // 7. Fees Logic
    let matchesFees = true;
    if (feesFilter !== "Fees" || recipientFilter !== "Recipient") {
      matchesFees = member.hasPaymentInPeriod;
    }

    return matchesSearch && matchesStatus && matchesGender && matchesJoined && matchesMedication && matchesFees;
  });

  const totalFeesCollected = payments.filter(p => {
    const pDate = new Date(p.date);
    const inDateRange = feesDateRange ? (pDate >= feesDateRange.start && pDate <= feesDateRange.end) : true;
    const matchesRecipient = recipientFilter === "Recipient" || (p.receivedBy && p.receivedBy.toLowerCase().includes(recipientFilter.toLowerCase()));
    return inDateRange && matchesRecipient;
  }).reduce((sum, p) => sum + getAllocatedAmount(p, recipientFilter), 0);

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("Status");
    setGenderFilter("Gender");
    setJoinedFilter("Joined");
    setMedicationFilter("Medication");
    setFeesFilter("Fees");
    setRecipientFilter("Recipient");
    setCustomStartDate("");
    setCustomEndDate("");
  };

  const renderFilterForm = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Filter Members</h4>
        {(searchTerm || statusFilter !== "Status" || genderFilter !== "Gender" || joinedFilter !== "Joined" || medicationFilter !== "Medication" || feesFilter !== "Fees" || recipientFilter !== "Recipient") && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">Reset</button>
        )}
      </div>
      
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Status</label>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "Status")}>
          <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Status">All Status</SelectItem>
            <SelectItem value="Active">Active Only</SelectItem>
            <SelectItem value="Expiring">Expiring Soon</SelectItem>
            <SelectItem value="Expired">Expired Members</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Gender</label>
        <Select value={genderFilter} onValueChange={(v) => setGenderFilter(v || "Gender")}>
          <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
            <SelectValue placeholder="Gender" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Gender">All Gender</SelectItem>
            <SelectItem value="Male">Male</SelectItem>
            <SelectItem value="Female">Female</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Joined Range</label>
        <Select value={joinedFilter} onValueChange={(v) => setJoinedFilter(v || "Joined")}>
          <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
            <SelectValue>
              {joinedFilter === "Joined" ? "All Time" :
               joinedFilter === "today" ? "Today" :
               joinedFilter === "yesterday" ? "Yesterday" :
               joinedFilter === "last7" ? "Last 7 Days" :
               joinedFilter === "1" ? "Last Month" :
               joinedFilter === "3" ? "Last 3 Months" :
               joinedFilter === "6" ? "Last 6 Months" : "Joined"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Joined">All Time</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="last7">Last 7 Days</SelectItem>
            <SelectItem value="1">Last Month</SelectItem>
            <SelectItem value="3">Last 3 Months</SelectItem>
            <SelectItem value="6">Last 6 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Medication</label>
        <Select value={medicationFilter} onValueChange={(v) => setMedicationFilter(v || "Medication")}>
          <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
            <SelectValue placeholder="Medication" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Medication">All</SelectItem>
            <SelectItem value="Medication: Yes">Taking Medication</SelectItem>
            <SelectItem value="Medication: No">No Medication</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Fees Collected</label>
        <Select value={feesFilter} onValueChange={(v) => {
          setFeesFilter(v || "Fees");
          if (v !== "custom") {
            setCustomStartDate("");
            setCustomEndDate("");
          }
        }}>
          <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
            <SelectValue>
              {feesFilter === "Fees" ? "All Fees Collected" :
               feesFilter === "today" ? "Today's Fees" :
               feesFilter === "yesterday" ? "Yesterday's Fees" :
               feesFilter === "last7" ? "Last 7 Days Fees" :
               feesFilter === "last30" ? "Last Month Fees" :
               feesFilter === "last90" ? "Quarterly Fees" :
               feesFilter === "half_yearly" ? "Half Yearly Fees" :
               feesFilter === "yearly" ? "Yearly Fees" :
               feesFilter === "custom" ? "Custom Range" : "Fees"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Fees">All Fees Collected</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="yesterday">Yesterday</SelectItem>
            <SelectItem value="last7">Last 7 Days</SelectItem>
            <SelectItem value="last30">Last Month</SelectItem>
            <SelectItem value="last90">Quarterly</SelectItem>
            <SelectItem value="half_yearly">Half Yearly</SelectItem>
            <SelectItem value="yearly">Yearly</SelectItem>
            <div 
              className="p-2 mt-1 border-t flex flex-col gap-2 bg-muted/10 rounded-b-md"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">From</span>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => {
                    setCustomStartDate(e.target.value);
                    if (e.target.value) setFeesFilter("custom");
                  }}
                  className="bg-background border rounded px-2 py-1 h-8 text-xs flex-1 outline-none focus:ring-1 focus:ring-[#B6916D] cursor-pointer"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-8">To</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => {
                    setCustomEndDate(e.target.value);
                    if (e.target.value) setFeesFilter("custom");
                  }}
                  className="bg-background border rounded px-2 py-1 h-8 text-xs flex-1 outline-none focus:ring-1 focus:ring-[#B6916D] cursor-pointer"
                />
              </div>
            </div>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Received By (Admin)</label>
        <Select value={recipientFilter} onValueChange={(v) => setRecipientFilter(v || "Recipient")}>
          <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
            <SelectValue placeholder="Select split recipient..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Recipient">All Recipients</SelectItem>
            {activeGym?.paymentRecipients?.map(r => (
              <SelectItem key={r} value={r}>{r}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 pt-12 lg:pt-0 border-b border-muted/20 pb-6">
          <div>
            <h1 className="text-2xl font-bold">Members</h1>
            <p className="text-muted-foreground text-sm">Manage your gym members and track memberships</p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Button 
              className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white font-medium w-full sm:w-auto" 
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" /> Add New Member
            </Button>
          </div>
        </div>

        <div className="bg-[#0F0F1A] border border-muted/20 rounded-xl p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search members..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#111322] border-white/[0.08] h-10 w-full rounded-md focus-visible:ring-1 focus-visible:ring-[#B6916D]"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2">
                {/* Mobile: Dialog-based filters */}
                <Button 
                  variant="outline" 
                  className="md:hidden bg-[#111322] border-white/[0.08] text-foreground hover:bg-[#151937] hover:text-white h-10"
                  onClick={() => setShowFilterDialog(true)}
                >
                  <Filter className="h-4 w-4 mr-2" /> Filters <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                </Button>

                {/* Desktop: Popover-based filters */}
                <div className="hidden md:block">
                  <Popover>
                    <PopoverTrigger render={<Button variant="outline" className="bg-[#111322] border-white/[0.08] text-foreground hover:bg-[#151937] hover:text-white h-10 text-xs sm:text-sm" />}>
                      <Filter className="h-4 w-4 mr-2" /> Filters <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                    </PopoverTrigger>
                    <PopoverContent className="w-80 max-h-[70vh] overflow-y-auto p-4 bg-[#0F0F1A] border border-white/[0.08] text-foreground rounded-xl shadow-xl z-[100] backdrop-blur-md" align="end">
                      {renderFilterForm()}
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <Button variant="outline" className="bg-[#111322] border-white/[0.08] text-foreground hover:bg-[#131313]/80 hover:text-white h-10 flex-1 sm:flex-none" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export
              </Button>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-muted/20 flex items-center flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground mr-2 font-medium">Active filters:</span>
            
            {statusFilter !== "Status" && (
              <Badge variant="secondary" className="bg-green-500/10 text-emerald-500 hover:bg-green-500/20 rounded-md py-1 px-2 border border-green-500/10 font-medium">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter("Status")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            
            {genderFilter !== "Gender" && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-[#B6916D] hover:bg-emerald-500/20 rounded-md py-1 px-2 border border-emerald-500/10 font-medium">
                Gender: {genderFilter}
                <button onClick={() => setGenderFilter("Gender")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {joinedFilter !== "Joined" && (
              <Badge variant="secondary" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-md py-1 px-2 border border-red-500/10 font-medium">
                Joined: {joinedFilter === "1" ? "Last Month" : joinedFilter === "3" ? "Last 3 Months" : joinedFilter === "6" ? "Last 6 Months" : joinedFilter}
                <button onClick={() => setJoinedFilter("Joined")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {medicationFilter !== "Medication" && (
              <Badge variant="secondary" className="bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded-md py-1 px-2 border border-orange-500/10 font-medium">
                {medicationFilter}
                <button onClick={() => setMedicationFilter("Medication")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {feesFilter !== "Fees" && (
              <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 rounded-md py-1 px-2 border border-blue-500/10 font-medium">
                Fees: {feesFilter}
                <button onClick={() => { setFeesFilter("Fees"); setCustomStartDate(""); setCustomEndDate(""); }} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {recipientFilter !== "Recipient" && (
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 rounded-md py-1 px-2 border border-purple-500/10 font-medium">
                Recipient: {recipientFilter}
                <button onClick={() => setRecipientFilter("Recipient")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {(feesFilter !== "Fees" || recipientFilter !== "Recipient") && (
              <div className="ml-auto bg-primary/10 text-[#B6916D] px-3 py-1 rounded-md border border-[#B6916D]/20 flex items-center gap-1 font-semibold text-xs">
                Total Collected: <IndianRupee className="h-3 w-3" />{totalFeesCollected.toLocaleString()}
              </div>
            )}

            {(statusFilter !== "Status" || genderFilter !== "Gender" || joinedFilter !== "Joined" || medicationFilter !== "Medication" || feesFilter !== "Fees" || recipientFilter !== "Recipient") && (
              <button 
                onClick={clearFilters}
                className={`text-[#B6916D] hover:text-[#0b8a5f] font-semibold transition-colors ${(feesFilter !== "Fees" || recipientFilter !== "Recipient") ? 'ml-2' : 'ml-auto'}`}
              >
                Clear all
              </button>
            )}
          </div>
        </div>

        <MemberTable members={filteredMembers} title="" />
      </main>

      {/* Mobile Filter Dialog */}
      <Dialog open={showFilterDialog} onOpenChange={setShowFilterDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-[#B6916D]" />
              Filter Members
            </DialogTitle>
            <DialogDescription className="text-[#8888A0]">Apply filters to narrow down the members list.</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {renderFilterForm()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { clearFilters(); setShowFilterDialog(false); }}>Reset All</Button>
            <Button className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white" onClick={() => setShowFilterDialog(false)}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddMemberDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        staff={staff}
      />
    </div>
  );
}
