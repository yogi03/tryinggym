"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Staff, Member } from "@/types";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, UserPlus, Loader2, ChevronLeft, ChevronRight, X, User, Search } from "lucide-react";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase/config";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";

interface StaffTableProps {
  staff: Staff[];
  allMembers: Member[];
  setAllMembers: React.Dispatch<React.SetStateAction<Member[]>>;
  assignedMap: Record<string, string[]>;
  setAssignedMap: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
}

export default function StaffTable({ staff, allMembers, setAllMembers, assignedMap, setAssignedMap }: StaffTableProps) {
  const router = useRouter();
  const { adminData, activeGym } = useAuth();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [staffToDelete, setStaffToDelete] = useState<Staff | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Assign Members
  const [assignOpen, setAssignOpen] = useState<string | null>(null); // staffId
  const [savingAssign, setSavingAssign] = useState(false);
  const [memberSearchTerm, setMemberSearchTerm] = useState("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(staff.length / itemsPerPage));
  
  const validPage = Math.min(currentPage, Math.max(1, totalPages));
  if (currentPage !== validPage && validPage > 0) setCurrentPage(validPage);

  const currentStaff = staff.slice(
    (validPage - 1) * itemsPerPage,
    validPage * itemsPerPage
  );

  const handleDelete = async () => {
    if (!adminData || !staffToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, "gyms", adminData.gymId, "staff", staffToDelete.staffId));
      toast({ title: "Deleted", description: "Staff member removed successfully." });
      setDeleteOpen(false);
      setStaffToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      toast({ title: "Error", description: "Failed to delete staff member.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleMemberAssignment = async (staffId: string, memberId: string) => {
    if (!adminData) return;
    setSavingAssign(true);
    const memberRef = doc(db, "gyms", adminData.gymId, "members", memberId);
    const member = allMembers.find(m => m.memberId === memberId);
    const isCurrentlyAssigned = member?.personalTrainerId === staffId;
    
    try {
      await updateDoc(memberRef, {
        personalTrainerId: isCurrentlyAssigned ? null : staffId
      });
      
      // Update local state
      setAllMembers(prev => prev.map(m => 
        m.memberId === memberId 
          ? { ...m, personalTrainerId: isCurrentlyAssigned ? undefined : staffId }
          : m
      ));
      
      setAssignedMap(prev => {
        const newMap = { ...prev };
        if (isCurrentlyAssigned) {
          newMap[staffId] = (newMap[staffId] || []).filter(id => id !== memberId);
        } else {
          // Remove from old trainer if assigned
          if (member?.personalTrainerId) {
            newMap[member.personalTrainerId] = (newMap[member.personalTrainerId] || []).filter(id => id !== memberId);
          }
          newMap[staffId] = [...(newMap[staffId] || []), memberId];
        }
        return newMap;
      });
      
      toast({ title: isCurrentlyAssigned ? "Unassigned" : "Assigned", description: `${member?.fullName} ${isCurrentlyAssigned ? "removed from" : "assigned to"} trainer.` });
    } catch (err) {
      console.error("Assign error:", err);
      toast({ title: "Error", description: "Failed to update assignment.", variant: "destructive" });
    } finally {
      setSavingAssign(false);
    }
  };

  const confirmDelete = (e: React.MouseEvent, s: Staff) => {
    e.stopPropagation();
    setStaffToDelete(s);
    setDeleteOpen(true);
  };

  const viewProfile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    router.push(`/admin/staff/${id}`);
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "trainer": return "text-[#10B981]";
      case "manager": return "text-orange-400";
      case "front desk": return "text-[#10B981]";
      default: return "text-muted-foreground";
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return <span className="bg-[#10B981]/20 text-[#10B981] px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">Active</span>;
      case "inactive":
        return <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">Inactive</span>;
      default:
        return <span className="bg-muted text-muted-foreground px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider">{status}</span>;
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const getDutyDays = (s: Staff) => {
    if (s.weekSchedule && s.weekSchedule.length > 0) {
      return s.weekSchedule.map(ws => ws.day).join(", ");
    }
    if (s.availability?.days && s.availability.days.length > 0) {
      return s.availability.days.join(", ");
    }
    return "—";
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm overflow-x-auto">
        <Table>
          <TableHeader className="bg-transparent">
            <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-[#8888A0] font-medium h-12 w-[250px] pl-6">Name</TableHead>
              <TableHead className="text-[#8888A0] font-medium">Role</TableHead>
              <TableHead className="text-[#8888A0] font-medium">Members</TableHead>
              <TableHead className="text-[#8888A0] font-medium">Salary</TableHead>
              <TableHead className="text-[#8888A0] font-medium">PT Earnings</TableHead>
              <TableHead className="text-[#8888A0] font-medium">Duty Days</TableHead>
              <TableHead className="text-[#8888A0] font-medium">Status</TableHead>
              <TableHead className="text-right text-[#8888A0] font-medium pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentStaff.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-[#8888A0]">
                  No staff members found matching the criteria.
                </TableCell>
              </TableRow>
            ) : (
              currentStaff.map((s) => {
                const assignedCount = (assignedMap[s.staffId] || []).length;
                const assignedMembers = allMembers.filter(m => m.personalTrainerId === s.staffId);
                
                let ptEarnings = 0;
                if (s.role === "Trainer") {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  // Members who are assigned to this trainer via personalTrainerId OR have a PT plan with this trainer
                  const assignedToTrainer = allMembers.filter(m => {
                    const hasPTPlanInHistory = (m.planHistory || []).some(p => 
                      p.trainingType === "personal" && 
                      (p.personalTrainerId === s.staffId || (!p.personalTrainerId && m.personalTrainerId === s.staffId))
                    );
                    return m.personalTrainerId === s.staffId || hasPTPlanInHistory;
                  });

                  assignedToTrainer.forEach(m => {
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
                      (p.personalTrainerId === s.staffId || (!p.personalTrainerId && m.personalTrainerId === s.staffId))
                    );

                    // 2. Identify active PT plan
                    const activePTPlan = trainerPTPlans.find(p => {
                      const start = new Date(p.startDate);
                      const end = new Date(p.endDate);
                      start.setHours(0,0,0,0);
                      end.setHours(0,0,0,0);
                      return start.getTime() <= today.getTime() && end.getTime() >= today.getTime();
                    });

                    // 3. Find earliest future PT plan if no active
                    const futurePTPlan = !activePTPlan ? trainerPTPlans
                      .filter(p => new Date(p.startDate).getTime() > today.getTime())
                      .sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] : null;

                    // 4. Default to overall active plan
                    const overallActivePlan = allPlans.find(p => {
                      const start = new Date(p.startDate);
                      const end = new Date(p.endDate);
                      start.setHours(0,0,0,0);
                      end.setHours(0,0,0,0);
                      return start.getTime() <= today.getTime() && end.getTime() >= today.getTime();
                    }) || null;

                    const plan = activePTPlan || futurePTPlan || overallActivePlan || currentEntry;
                    const isPersonalTraining = plan.trainingType === "personal" || m.personalTrainerId === s.staffId || activePTPlan || futurePTPlan;
                    
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
                      ptEarnings += earn;
                    }
                  });
                }

                return (
                  <TableRow 
                    key={s.staffId} 
                    className="group border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={(e) => viewProfile(e, s.staffId)}
                  >
                    <TableCell className="font-medium flex items-center gap-3 py-3 pl-6">
                      <div className="h-10 w-10 rounded-full bg-muted/30 overflow-hidden flex-shrink-0 flex items-center justify-center border border-muted/20">
                        {s.photoUrl ? (
                           <img src={s.photoUrl} alt={s.fullName} className="h-full w-full object-cover" />
                        ) : (
                           <span className="text-sm font-semibold text-muted-foreground">{getInitials(s.fullName)}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-foreground">{s.fullName}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={s.email}>{s.email}</span>
                      </div>
                    </TableCell>
                    
                    <TableCell>
                      <span className={`text-xs font-medium ${getRoleColor(s.role)}`}>{s.role}</span>
                    </TableCell>

                    <TableCell>
                      {s.role === "Trainer" ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-foreground font-medium">{assignedCount}</span>
                          {assignedCount > 0 && (
                            <div className="flex -space-x-2">
                              {assignedMembers.slice(0, 3).map(m => (
                                <div key={m.memberId} className="h-6 w-6 rounded-full border-2 border-[#1C1C1E] overflow-hidden bg-muted/30 flex items-center justify-center" title={m.fullName}>
                                  {m.photoUrl ? (
                                    <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-semibold text-muted-foreground">{m.fullName.substring(0, 2).toUpperCase()}</span>
                                  )}
                                </div>
                              ))}
                              {assignedCount > 3 && (
                                <div className="h-6 w-6 rounded-full border-2 border-[#1C1C1E] bg-[#10B981]/20 flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-[#10B981]">+{assignedCount - 3}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <span className="text-sm text-foreground">{s.salary ? `₹${s.salary.toLocaleString()}` : "—"}</span>
                    </TableCell>

                    <TableCell>
                      {s.role === "Trainer" ? (
                        <span className="text-sm font-semibold text-[#B6916D]">
                          ₹{ptEarnings.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <span className="text-xs text-muted-foreground">{getDutyDays(s)}</span>
                    </TableCell>

                    <TableCell>
                      {getStatusBadge(s.status)}
                    </TableCell>

                    <TableCell className="text-right pr-6">
                      <div className="flex items-center justify-end gap-3">
                        <button 
                          onClick={(e) => viewProfile(e, s.staffId)}
                          className="text-muted-foreground hover:text-[#10B981] transition-colors"
                          title="View Profile"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        {s.role === "Trainer" && (
                          <Popover open={assignOpen === s.staffId} onOpenChange={(open) => { if (!open) { setAssignOpen(null); setMemberSearchTerm(""); } }}>
                            <PopoverTrigger render={
                              <button 
                                onClick={(e) => { e.stopPropagation(); setAssignOpen(s.staffId); setMemberSearchTerm(""); }}
                                className="text-muted-foreground hover:text-emerald-400 transition-colors"
                                title="Assign Members"
                              />
                            }>
                                <UserPlus className="h-4 w-4" />
                            </PopoverTrigger>
                            <PopoverContent className="w-80 bg-[#1C1C1E] border-muted/20 text-foreground p-0" align="end" onClick={(e) => e.stopPropagation()}>
                              <div className="p-3 border-b border-muted/20">
                                <p className="text-sm font-semibold">Assign Members to {s.fullName}</p>
                                <p className="text-xs text-muted-foreground mt-1">Toggle members for personal training</p>
                              </div>
                              <div className="p-2 border-b border-muted/20">
                                <div className="relative">
                                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                  <Input
                                    placeholder="Search by name, phone, email..."
                                    value={memberSearchTerm}
                                    onChange={(e) => setMemberSearchTerm(e.target.value)}
                                    className="pl-8 h-8 text-sm bg-[#131313] border-muted/20 focus-visible:ring-1 focus-visible:ring-[#10B981]"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                              </div>
                              <div className="max-h-[250px] overflow-y-auto custom-scrollbar">
                                {allMembers.filter(m => {
                                  if (!memberSearchTerm) return true;
                                  const q = memberSearchTerm.toLowerCase();
                                  return m.fullName.toLowerCase().includes(q) ||
                                    m.phone.toLowerCase().includes(q) ||
                                    m.email.toLowerCase().includes(q) ||
                                    m.memberId.toLowerCase().includes(q) ||
                                    (m.nickname && m.nickname.toLowerCase().includes(q));
                                }).map(m => {
                                  const isAssigned = m.personalTrainerId === s.staffId;
                                  const isAssignedElsewhere = m.personalTrainerId && m.personalTrainerId !== s.staffId;
                                  return (
                                    <button
                                      key={m.memberId}
                                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-[#2C2C2E] transition-colors ${isAssigned ? "bg-[#10B981]/5" : ""}`}
                                      onClick={() => toggleMemberAssignment(s.staffId, m.memberId)}
                                      disabled={savingAssign || !!isAssignedElsewhere}
                                    >
                                      <div className="h-8 w-8 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                                        {m.photoUrl ? (
                                          <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                                        ) : (
                                          <User className="h-4 w-4 text-muted-foreground/40" />
                                        )}
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{m.fullName}</p>
                                        <p className="text-[10px] text-muted-foreground font-mono">{m.memberId}</p>
                                      </div>
                                      <Checkbox 
                                        checked={isAssigned} 
                                        className="border-muted-foreground/30 data-[state=checked]:bg-[#10B981] data-[state=checked]:border-[#10B981]"
                                        disabled={!!isAssignedElsewhere}
                                      />
                                    </button>
                                  );
                                })}
                                {allMembers.length === 0 && (
                                  <p className="text-sm text-muted-foreground text-center py-6">No members found.</p>
                                )}
                                {allMembers.length > 0 && memberSearchTerm && allMembers.filter(m => {
                                  const q = memberSearchTerm.toLowerCase();
                                  return m.fullName.toLowerCase().includes(q) ||
                                    m.phone.toLowerCase().includes(q) ||
                                    m.email.toLowerCase().includes(q) ||
                                    m.memberId.toLowerCase().includes(q) ||
                                    (m.nickname && m.nickname.toLowerCase().includes(q));
                                }).length === 0 && (
                                  <p className="text-sm text-muted-foreground text-center py-6">No members match "{memberSearchTerm}"</p>
                                )}
                              </div>
                            </PopoverContent>
                          </Popover>
                        )}
                        <button 
                          onClick={(e) => confirmDelete(e, s)}
                          className="text-muted-foreground hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-muted/20 text-sm">
            <div className="text-muted-foreground">
              Showing {(validPage - 1) * itemsPerPage + 1} to {Math.min(validPage * itemsPerPage, staff.length)} of {staff.length} Staff Members
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent border-muted/20 hover:bg-muted/10 hover:text-white"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={validPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                if (page === 1 || page === totalPages || Math.abs(page - validPage) <= 1) {
                  return (
                    <Button
                      key={page}
                      variant="outline"
                      className={`h-8 w-8 p-0 border text-sm font-medium ${page === validPage ? 'bg-[#1C1C1E] border-[#10B981] text-[#10B981]' : 'bg-transparent border-transparent text-muted-foreground hover:border-muted/20 hover:text-white'}`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  );
                }
                if (page === validPage - 2 || page === validPage + 2) {
                  return <span key={page} className="px-1 text-muted-foreground">...</span>;
                }
                return null;
              })}
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-transparent border-muted/20 hover:bg-muted/10 hover:text-white"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={validPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-red-500">Delete Staff Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {staffToDelete?.fullName}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting...</> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
