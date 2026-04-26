"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, doc, onSnapshot, where, addDoc, setDoc, limit } from "firebase/firestore";
import { Member, Gym } from "@/types";
import AdminSidebar from "@/components/admin/Sidebar";
import MemberTable from "@/components/admin/MemberTable";
import DashboardStatCards from "@/components/admin/dashboard/StatCards";
import QuickActions from "@/components/admin/dashboard/QuickActions";
import DashboardRevenueChart from "@/components/admin/dashboard/DashboardRevenueChart";
import UpcomingRenewals from "@/components/admin/dashboard/UpcomingRenewals";
import PendingInstallments from "@/components/admin/dashboard/PendingInstallments";
import RegistrationLinks from "@/components/admin/dashboard/RegistrationLinks";
import UniversalSearch from "@/components/admin/dashboard/UniversalSearch";
import AddStaffDialog from "@/components/admin/dashboard/AddStaffDialog";
import AddMemberDialog from "@/components/admin/dashboard/AddMemberDialog";
import TrialPassDialog from "@/components/admin/dashboard/TrialPassDialog";
import AddInquiryDialog from "@/components/admin/inquiry/AddInquiryDialog";
import { Staff, Inquiry } from "@/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { compressAndUploadPhoto } from "@/lib/cloudinary";
import { ToastAction } from "@/components/ui/toast";
import {
  Loader2, AlertTriangle, UserPlus, Camera, X, AlertCircle, Calendar, ChevronRight
} from "lucide-react";

const DEFAULT_ADD_FORM = {
  fullName: "", phone: "", email: "",
  gender: "male" as "male" | "female" | "other" | "prefer-not-to-say",
  dob: "", address: "",
  membershipType: "monthly" as Member["membershipType"],
  membershipStartDate: new Date().toISOString().split("T")[0],
  membershipEndDate: "",
  feesPaid: "", healthAssessment: "", isTakingMedication: "no",
  fitnessGoals: "", paymentOption: "cash", nickname: "",
  notes: "",
  trainingType: "general" as "general" | "personal",
  personalTrainerId: "",
};

function calculateEndDate(startDateStr: string, type: string): string {
  if (!startDateStr || type === "other") return "";
  const startDate = new Date(startDateStr);
  if (isNaN(startDate.getTime())) return "";
  if (type === "monthly") startDate.setMonth(startDate.getMonth() + 1);
  else if (type === "quarterly") startDate.setMonth(startDate.getMonth() + 3);
  else if (type === "half-yearly") startDate.setMonth(startDate.getMonth() + 6);
  else if (type === "yearly") startDate.setMonth(startDate.getMonth() + 12);
  else if (type === "trial") startDate.setDate(startDate.getDate() + 1);
  return startDate.toISOString().split("T")[0];
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AdminDashboard() {
  const router = useRouter();
  const { adminData, frontDeskData, isFrontDesk, loading: authLoading } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [revenueData, setRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [multiYearRevenueData, setMultiYearRevenueData] = useState<{ month: string; revenue: number }[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddStaffDialog, setShowAddStaffDialog] = useState(false);
  const [showAddInquiryDialog, setShowAddInquiryDialog] = useState(false);
  const [showTrialDialog, setShowTrialDialog] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [todayCollection, setTodayCollection] = useState(0);

  useEffect(() => {
    if (!gymId) return;

    setLoading(true);
    let unsubGym: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let unsubMembers: (() => void) | undefined;
    let unsubStaff: (() => void) | undefined;
    let unsubInquiries: (() => void) | undefined;

    const setupListeners = () => {
      try {
        // 1. Gym Doc Listener
        unsubGym = onSnapshot(doc(db, "gyms", gymId), (snapshot) => {
          if (snapshot.exists()) {
            const gymData = snapshot.data() as Gym;
            setGym(gymData);
            const today = new Date();
            const end = new Date(gymData.subscriptionEnd);
            setShowSubscriptionModal(end < today || gymData.subscriptionStatus === "expired");
          } else {
            setGym(null);
          }
        });

        // 2. Payments Listener (for Revenue & Collection)
        unsubPayments = onSnapshot(collection(db, "gyms", gymId, "payments"), (snapshot) => {
          const currentYear = new Date().getFullYear();
          const monthlyRevenue: Record<string, number> = {};
          MONTHS.forEach(m => { monthlyRevenue[m] = 0; });
          
          const multiYearMap: Record<number, number> = {};
          for (let i = currentYear - 3; i <= currentYear; i++) {
            multiYearMap[i] = 0;
          }

          let todayRevenue = 0;
          const todayStr = new Date().toDateString();

          snapshot.forEach(paymentDoc => {
            const data = paymentDoc.data();
            if (data.date && data.amount) {
              const d = new Date(data.date);
              const y = d.getFullYear();
              
              if (y === currentYear) {
                monthlyRevenue[MONTHS[d.getMonth()]] += Number(data.amount) || 0;
              }
              
              if (multiYearMap[y] !== undefined) {
                multiYearMap[y] += Number(data.amount) || 0;
              }

              if (d.toDateString() === todayStr) {
                todayRevenue += Number(data.amount) || 0;
              }
            }
          });

          setRevenueData(MONTHS.map(m => ({ month: m, revenue: monthlyRevenue[m] })));
          setMultiYearRevenueData(Object.keys(multiYearMap).sort().map(y => ({ month: y, revenue: multiYearMap[Number(y)] })));
          setTodayCollection(todayRevenue);
        });

        // 3. Members Listener
        unsubMembers = onSnapshot(collection(db, "gyms", gymId, "members"), (snapshot) => {
          setMembers(snapshot.docs.map(d => ({ memberId: d.id, ...d.data() })) as Member[]);
          setLoading(false);
        });

        // 4. Staff Listener
        unsubStaff = onSnapshot(collection(db, "gyms", gymId, "staff"), (snapshot) => {
          setStaff(snapshot.docs.map(d => ({ staffId: d.id, ...d.data() })) as Staff[]);
        });

        // 5. Inquiries Listener
        unsubInquiries = onSnapshot(collection(db, "gyms", gymId, "inquiries"), (snapshot) => {
          setInquiries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Inquiry[]);
        });

      } catch (error) {
        console.error("Dashboard listeners error:", error);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubGym?.();
      unsubPayments?.();
      unsubMembers?.();
      unsubStaff?.();
      unsubInquiries?.();
    };
  }, [gymId]);

  if (authLoading || loading) {
    return (<div className="flex h-screen items-center justify-center bg-[#0F0F1A]"><Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" /></div>);
  }

  const stats = (() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const active = members.filter(m => new Date(m.membershipEndDate) >= now);
    const expired = members.filter(m => new Date(m.membershipEndDate) < now);
    
    const newSignups = members.filter(m => {
      if (!m.createdAt) return false;
      return new Date(m.createdAt) >= startOfMonth;
    });

    const churn = members.length > 0 ? (expired.length / members.length) * 100 : 0;
    
    const mrr = active.reduce((acc, m) => {
      let months = 1;
      if (m.membershipType === "monthly") months = 1;
      else if (m.membershipType === "quarterly") months = 3;
      else if (m.membershipType === "half-yearly") months = 6;
      else if (m.membershipType === "yearly") months = 12;
      else if (m.membershipType === "trial") months = 0.03; 
      
      const lastAmt = m.feesPaid || 0; 
      return acc + (lastAmt / months);
    }, 0);

    const fiveDaysAway = new Date();
    fiveDaysAway.setDate(now.getDate() + 5);
    const expiringSoonList = members.filter(m => {
      const end = new Date(m.membershipEndDate);
      return end >= now && end <= fiveDaysAway && !m.isArchived;
    });

    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(now.getDate() - 10);
    const inactive = members.filter(m => {
      const end = new Date(m.membershipEndDate);
      return end < tenDaysAgo && !m.isArchived;
    });

    const dueInquiries = inquiries.filter(inq => {
      if (inq.status === "converted" || !inq.reminderDate) return false;
      return inq.reminderDate <= todayStr;
    });

    return {
      activeMembers: active.length,
      newSignups: newSignups.length,
      churnRate: churn,
      mrr: Math.round(mrr),
      attendanceToday: 0, 
      inactiveMembers: inactive.length,
      expiringSoonList: expiringSoonList,
      totalMembers: members.length,
      todayCollection: todayCollection,
      dueInquiries: dueInquiries
    };
  })();

  const today = new Date();
  today.setHours(0,0,0,0);

  const todayRegistrations = members.filter(m => {
    if (!m.createdAt || m.isAcknowledged) return false;
    const d = new Date(m.createdAt);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-3 sm:p-5 lg:p-8 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto space-y-5 sm:space-y-6 pt-14 lg:pt-0">

          {/* Universal Search */}
          <UniversalSearch members={members} staff={staff} includeStaff={true} />

          {/* Alert Banner */}
          {stats.expiringSoonList.length > 0 && !alertDismissed && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-300">Renewal attention needed</p>
                  <p className="text-xs text-amber-400/70">{stats.expiringSoonList.length} member{stats.expiringSoonList.length !== 1 ? "s have" : " has"} memberships expiring within 5 days</p>
                </div>
              </div>
              <button onClick={() => setAlertDismissed(true)} className="text-amber-400/60 hover:text-amber-300 transition-colors"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* Inquiry Follow-up Banner */}
          {stats.dueInquiries.length > 0 && !alertDismissed && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[#B6916D]/10 border border-[#B6916D]/20">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-[#B6916D] shrink-0" />
                <div>
                  <p className="text-sm font-medium text-[#B6916D]">Inquiry follow-ups today</p>
                  <p className="text-xs text-[#B6916D]/70">{stats.dueInquiries.length} inquiry{stats.dueInquiries.length !== 1 ? "ies require" : "y requires"} attention today</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-[#B6916D] hover:bg-[#B6916D]/10 text-xs gap-2"
                onClick={() => router.push("/admin/inquiries")}
              >
                View Inquiries <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Stat Cards */}
          <DashboardStatCards stats={stats} mode={isFrontDesk ? "front_desk" : "admin"} />

          {/* Quick Actions */}
          <QuickActions 
            onAddMember={() => setShowAddDialog(true)} 
            onAddStaff={() => setShowAddStaffDialog(true)}
            onAddInquiry={() => setShowAddInquiryDialog(true)}
            onAddTrial={() => setShowTrialDialog(true)}
            mode={isFrontDesk ? "front_desk" : "admin"}
          />

          {/* Registration Links */}
          {gymId && <RegistrationLinks gymId={gymId} />}

          {/* Revenue Chart */}
          {!isFrontDesk && <DashboardRevenueChart data={revenueData} multiYearData={multiYearRevenueData} />}

          {/* Today's Registrations */}
          {todayRegistrations.length > 0 && (
            <MemberTable members={todayRegistrations} title="Today's New Registrations" showDoneButton hideSelection />
          )}

          {/* Upcoming Renewals */}
          <UpcomingRenewals members={members} />

          {/* Pending Installments */}
          <PendingInstallments members={members} staff={staff} />

        </div>

        {/* Subscription Expired Modal */}
        <Dialog open={showSubscriptionModal} onOpenChange={setShowSubscriptionModal}>
          <DialogContent className="sm:max-w-md"><DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" />Subscription Expired</DialogTitle>
            <DialogDescription>Your gym&apos;s subscription to GymManagr has expired. Please renew to maintain access.</DialogDescription>
          </DialogHeader>
          <div className="bg-muted p-4 rounded-md text-sm">
            <div className="flex justify-between mb-2"><span className="text-muted-foreground">Gym:</span><span className="font-bold">{gym?.name}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Expired on:</span><span className="font-bold">{gym?.subscriptionEnd ? new Date(gym.subscriptionEnd).toLocaleDateString() : "N/A"}</span></div>
          </div>
          <DialogFooter className="sm:justify-start"><Button type="button" variant="default" className="w-full">Renew Subscription</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {/* Add Member Dialog */}
      <AddMemberDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        staff={staff}
      />

      <AddStaffDialog 
        open={showAddStaffDialog} 
        onOpenChange={setShowAddStaffDialog} 
      />

      <AddInquiryDialog
        open={showAddInquiryDialog}
        onOpenChange={setShowAddInquiryDialog}
        staff={staff}
      />

      <TrialPassDialog
        open={showTrialDialog}
        onOpenChange={setShowTrialDialog}
      />
    </div>
  );
}
