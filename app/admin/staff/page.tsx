"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, doc, setDoc, onSnapshot, where } from "firebase/firestore";
import { Staff, Member } from "@/types";
import AdminSidebar from "@/components/admin/Sidebar";
import StaffTable from "@/components/admin/StaffTable";
import { Loader2, Search, Plus, UserPlus, Camera, X, Filter, ChevronDown, IndianRupee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import AddStaffDialog from "@/components/admin/dashboard/AddStaffDialog";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StaffPage() {
  const { adminData, activeGym, frontDeskData, loading: authLoading } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const { toast } = useToast();
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  // Members and Assignments State
  const [allMembers, setAllMembers] = useState<Member[]>([]);
  const [assignedMap, setAssignedMap] = useState<Record<string, string[]>>({});

  // Filters State
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("All Roles");
  const [statusFilter, setStatusFilter] = useState("Status");

  // Add Dialog State
  const [showAddDialog, setShowAddDialog] = useState(false);

  useEffect(() => {
    if (!gymId) return;

    setLoading(true);
    let unsubStaff: (() => void) | undefined;
    let unsubMembers: (() => void) | undefined;

    const setupListeners = () => {
      try {
        // 1. Staff Listener
        unsubStaff = onSnapshot(collection(db, "gyms", gymId, "staff"), (snapshot) => {
          const nextStaff = snapshot.docs.map(doc => ({
            staffId: doc.id,
            ...doc.data()
          })) as Staff[];
          setStaffList(nextStaff);
        });

        // 2. Members Listener (for Assignments & Count)
        unsubMembers = onSnapshot(collection(db, "gyms", gymId, "members"), (snapshot) => {
          const members = snapshot.docs.map(d => ({ memberId: d.id, ...d.data() })) as Member[];
          
          const map: Record<string, string[]> = {};
          members.forEach(m => {
            if (m.personalTrainerId) {
              if (!map[m.personalTrainerId]) map[m.personalTrainerId] = [];
              map[m.personalTrainerId].push(m.memberId);
            }
          });

          setAllMembers(members);
          setAssignedMap(map);
          setLoading(false);
        });

      } catch (err) {
        console.error("Staff page listeners error:", err);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubStaff?.();
      unsubMembers?.();
    };
  }, [gymId]);

  const filteredStaff = staffList.filter(staff => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      staff.fullName.toLowerCase().includes(searchLower) ||
      staff.email.toLowerCase().includes(searchLower) ||
      staff.role.toLowerCase().includes(searchLower) ||
      staff.staffId.toLowerCase().includes(searchLower);

    const matchesRole = roleFilter === "All Roles" || staff.role === roleFilter;
    const matchesStatus = statusFilter === "Status" || staff.status === statusFilter;

    return matchesSearch && matchesRole && matchesStatus;
  });


  const clearFilters = () => {
    setSearchTerm("");
    setRoleFilter("All Roles");
    setStatusFilter("Status");
  };

  const hasActiveFilters = roleFilter !== "All Roles" || statusFilter !== "Status" || searchTerm;

  const totalPTEarnings = useMemo(() => {
    let total = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    filteredStaff.forEach(staff => {
      if (staff.role === "Trainer") {
        // Members who are assigned to this trainer via personalTrainerId OR have a PT plan with this trainer
        const assignedMembers = allMembers.filter(m => {
          const hasPTPlanInHistory = (m.planHistory || []).some(p => 
            p.trainingType === "personal" && 
            (p.personalTrainerId === staff.staffId || (!p.personalTrainerId && m.personalTrainerId === staff.staffId))
          );
          return m.personalTrainerId === staff.staffId || hasPTPlanInHistory;
        });

        assignedMembers.forEach(m => {
          const currentEntry = {
            startDate: m.membershipStartDate || "",
            endDate: m.membershipEndDate || "",
            amountPaid: Number(m.feesPaid) || 0,
            planType: m.membershipType as string,
            trainingType: m.trainingType || "general",
            personalTrainerId: m.trainingType === "personal" ? m.personalTrainerId || null : null,
            withGst: (m as any).withGst || false,
            ptGymFee: m.ptGymFee
          };
          
          const planHistory = (m.planHistory || []).map(p => ({
            ...p,
            trainingType: p.trainingType || "general",
            personalTrainerId: p.trainingType === "personal" ? (p.personalTrainerId ?? null) : null,
            withGst: p.withGst || (m as any).withGst || false
          }));
          
          const hasCurrentInHistory = planHistory.some(
            p => p.startDate === m.membershipStartDate && p.endDate === m.membershipEndDate
          );
          
          const allPlans = [
            ...planHistory,
            ...(hasCurrentInHistory ? [] : [currentEntry])
          ]
            .filter(p => p.startDate && p.endDate)
            .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());

          // 1. Find all active/future PT plans for this trainer
          const trainerPTPlans = allPlans.filter(p => 
            p.trainingType === "personal" && 
            (p.personalTrainerId === staff.staffId || (!p.personalTrainerId && m.personalTrainerId === staff.staffId))
          );

          // 2. Identify active PT plan
          const activePTPlan = trainerPTPlans.find(p => {
            const s = new Date(p.startDate);
            const e = new Date(p.endDate);
            s.setHours(0,0,0,0);
            e.setHours(0,0,0,0);
            return s.getTime() <= today.getTime() && e.getTime() >= today.getTime();
          });

          // 3. Find earliest future PT plan if no active
          const futurePTPlan = !activePTPlan ? trainerPTPlans
            .filter(p => new Date(p.startDate).getTime() > today.getTime())
            .sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] : null;

          // 4. Default to overall active plan (could be general)
          const overallActivePlan = allPlans.find(p => {
            const s = new Date(p.startDate);
            const e = new Date(p.endDate);
            s.setHours(0,0,0,0);
            e.setHours(0,0,0,0);
            return s.getTime() <= today.getTime() && e.getTime() >= today.getTime();
          }) || null;

          const plan = activePTPlan || futurePTPlan || overallActivePlan || currentEntry;
          const isPersonalTraining = plan.trainingType === "personal" || m.personalTrainerId === staff.staffId || activePTPlan || futurePTPlan;
          
          if (isPersonalTraining) {
            let months = 1;
            const start = plan.startDate;
            const end = plan.endDate;
            if (start && end) {
              const diffDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
              months = Math.max(1, Math.round(diffDays / 30));
            } else {
              const mType = (plan.planType || "").toLowerCase();
              if (mType.includes("quarterly")) months = 3;
              else if (mType.includes("half-yearly")) months = 6;
              else if (mType.includes("yearly")) months = 12;
            }

            const amount = Number(plan.amountPaid) || 0;
            const monthlyFee = amount / months;
            const hasGst = !!(plan.withGst || (m as any).withGst);
            const gstDeduction = hasGst ? (monthlyFee * 0.05) : 0;
            
            const baseGymFee = plan?.ptGymFee ?? m.ptGymFee ?? activeGym?.ptGymFee ?? 2000;
            const earn = Math.max(0, (monthlyFee - baseGymFee - gstDeduction) * 0.5);
            total += earn;
          }
        });
      }
    });
    return total;
  }, [filteredStaff, allMembers, activeGym]);

  if (authLoading || loading) {
    return (
      <div className="flex bg-[#131313] h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#10B981]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 pt-12 lg:pt-0 border-b border-muted/20 pb-6">
          <div>
            <h1 className="text-2xl font-bold">Trainers & Staff</h1>
            <p className="text-muted-foreground text-sm">Manage trainers, staff members, and assignments</p>
          </div>
          <Button 
            className="bg-[#10B981] hover:bg-[#10B981]/90 text-white font-medium h-10 px-4" 
            onClick={() => setShowAddDialog(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Staff Member
          </Button>
        </div>

        {/* Filters Bar - matching Members page style */}
        <div className="bg-[#0F0F1A] border border-muted/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search staff..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-[#111322] border-white/[0.08] h-10 w-full rounded-md focus-visible:ring-1 focus-visible:ring-[#10B981]"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="bg-[#111322] border-white/[0.08] text-foreground hover:bg-[#131313]/80 hover:text-white h-10"><Filter className="h-4 w-4 mr-2" /> Filters <ChevronDown className="h-4 w-4 ml-1 opacity-50" /></Button>}>
                </PopoverTrigger>
                <PopoverContent className="w-72 max-h-[70vh] overflow-y-auto p-4 bg-[#0F0F1A] border border-white/[0.08] text-foreground rounded-xl shadow-xl z-50" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Filter Staff</h4>
                      {hasActiveFilters && (
                        <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">Reset</button>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Role</label>
                      <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v || "All Roles")}>
                        <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
                          <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="All Roles">All Roles</SelectItem>
                          <SelectItem value="Trainer">Trainer</SelectItem>
                          <SelectItem value="Manager">Manager</SelectItem>
                          <SelectItem value="Front Desk">Front Desk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs text-muted-foreground">Status</label>
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "Status")}>
                        <SelectTrigger className="w-full h-9 bg-[#111322] border-white/[0.08]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Status">Any Status</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
          
          {/* Active Filters Row */}
          <div className="mt-4 pt-4 border-t border-muted/20 flex items-center flex-wrap gap-2 text-sm">
            <span className="text-muted-foreground mr-2 font-medium">Active filters:</span>
            
            {roleFilter !== "All Roles" && (
              <Badge variant="secondary" className="bg-emerald-500/10 text-[#10B981] hover:bg-emerald-500/20 rounded-md py-1 px-2 border border-emerald-500/10 font-medium">
                Role: {roleFilter}
                <button onClick={() => setRoleFilter("All Roles")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {statusFilter !== "Status" && (
              <Badge variant="secondary" className="bg-green-500/10 text-emerald-500 hover:bg-green-500/20 rounded-md py-1 px-2 border border-green-500/10 font-medium">
                Status: {statusFilter}
                <button onClick={() => setStatusFilter("Status")} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {hasActiveFilters && (
              <button 
                onClick={clearFilters}
                className="text-[#10B981] hover:text-[#10B981]/80 font-semibold transition-colors ml-auto mr-2"
              >
                Clear all
              </button>
            )}

            {!hasActiveFilters && (
              <span className="text-muted-foreground text-xs">None</span>
            )}

            <div className="ml-auto bg-[#B6916D]/10 text-[#B6916D] px-3 py-1 rounded-md border border-[#B6916D]/20 flex items-center gap-1 font-semibold text-xs whitespace-nowrap mt-2 sm:mt-0">
              Total PT Earnings: <IndianRupee className="h-3 w-3" />{totalPTEarnings.toLocaleString()}
            </div>
          </div>
        </div>

        <StaffTable 
          staff={filteredStaff} 
          allMembers={allMembers}
          setAllMembers={setAllMembers}
          assignedMap={assignedMap}
          setAssignedMap={setAssignedMap}
        />
      </main>

      <AddStaffDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
      />
    </div>
  );
}
