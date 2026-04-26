"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, collection, query, where, getDocs, updateDoc, onSnapshot } from "firebase/firestore";
import { archiveStaff } from "@/lib/firebase/archive";
import { createOrResetStaffAuth, getTrainerMembers } from "@/app/admin/staff/actions";
import { Staff, Member } from "@/types";
import { Loader2, ArrowLeft, Mail, Phone, User, Camera, Edit, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import AdminSidebar from "@/components/admin/Sidebar";
import { compressAndUploadPhoto } from "@/lib/cloudinary";
import { deleteCloudinaryImage } from "@/app/actions/cloudinary";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function StaffProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { adminData, activeGym, trainerData, frontDeskData, user, isTrainer, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [assignedMembers, setAssignedMembers] = useState<(Member & { activePlan: { startDate: string; endDate: string; amountPaid: number; planType: string; trainingType: "general" | "personal"; personalTrainerId: string | null; withGst?: boolean } | null })[]>([]);
  const [isPhotoUpdating, setIsPhotoUpdating] = useState(false);
  const gymId = adminData?.gymId || trainerData?.gymId || frontDeskData?.gymId || null;
  const activeStaffId = isTrainer ? trainerData?.staffId : (params?.id as string | undefined);

  // Edit Dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    salary: "",
    certifications: "",
    specialties: "",
    weekSchedule: [] as { day: string; startTime: string; endTime: string }[],
    joiningDate: "",
    notes: "",
  });
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [trainerAccessOpen, setTrainerAccessOpen] = useState(false);
  const [trainerLoginPassword, setTrainerLoginPassword] = useState("");
  const [trainerLoginEmail, setTrainerLoginEmail] = useState("");
  const [isSavingTrainerLogin, setIsSavingTrainerLogin] = useState(false);

  useEffect(() => {
    if (!gymId || !activeStaffId) {
      if (!authLoading) setLoading(false);
      return;
    }

    setLoading(true);
    let unsubStaff: (() => void) | undefined;
    let unsubMembers: (() => void) | undefined;

    const setupListeners = () => {
      try {
        // 1. Staff Listener
        unsubStaff = onSnapshot(doc(db, "gyms", gymId, "staff", activeStaffId), (staffDoc) => {
          if (staffDoc.exists()) {
            const data = { staffId: staffDoc.id, ...staffDoc.data() } as Staff;
            setStaff(data);
            setTrainerLoginEmail(data.trainerLoginEmail || data.email || "");

            setEditForm({
              fullName: data.fullName,
              email: data.email,
              phone: data.phone,
              salary: data.salary?.toString() || "",
              certifications: data.certifications?.join(", ") || "",
              specialties: data.specialties?.join(", ") || "",
              weekSchedule: data.weekSchedule || [],
              joiningDate: data.joiningDate || "",
              notes: data.notes || "",
            });
          } else {
            setLoading(false);
            router.push(isTrainer && trainerData?.staffId ? `/admin/staff/${trainerData.staffId}` : "/admin/staff");
          }
        }, (error) => {
          console.error("Staff profile listener error:", error);
          setLoading(false);
          toast({ title: "Error", description: "Failed to load staff profile.", variant: "destructive" });
        });

        // 2. Members (Assigned to Staff) Logic
        const handleMembersData = (allMembers: Member[]) => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const assigned = allMembers.map(m => {
            const currentEntry = {
              startDate: m.membershipStartDate,
              endDate: m.membershipEndDate,
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

            const todayStart = new Date(today);
            todayStart.setHours(0,0,0,0);

            // 1. Find all active/future PT plans for this trainer
            const trainerPTPlans = allPlans.filter(p => 
              p.trainingType === "personal" && 
              (p.personalTrainerId === activeStaffId || (!p.personalTrainerId && m.personalTrainerId === activeStaffId))
            );

            // 2. Identify the active PT plan for this trainer if it exists
            const activePTPlan = trainerPTPlans.find(p => {
              const s = new Date(p.startDate);
              const e = new Date(p.endDate);
              s.setHours(0,0,0,0);
              e.setHours(0,0,0,0);
              return s.getTime() <= todayStart.getTime() && e.getTime() >= todayStart.getTime();
            });

            // 3. If no active PT plan, find the EARLIEST future PT plan for this trainer
            const futurePTPlan = !activePTPlan ? trainerPTPlans
              .filter(p => new Date(p.startDate).getTime() > todayStart.getTime())
              .sort((a,b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0] : null;

            // 4. Default to the overall active plan (could be General Training)
            const overallActivePlan = allPlans.find(p => {
              const s = new Date(p.startDate);
              const e = new Date(p.endDate);
              s.setHours(0,0,0,0);
              e.setHours(0,0,0,0);
              return s.getTime() <= todayStart.getTime() && e.getTime() >= todayStart.getTime();
            }) || null;

            // Priority: Active PT > Future PT > Overall Active > Current Entry
            const displayPlan = activePTPlan || futurePTPlan || overallActivePlan || currentEntry;

            return { ...m, activePlan: displayPlan };
          }).filter(m => {
            // Include if assigned at profile level OR has our PT plan (active or future)
            const hasPTPlan = (m.planHistory || []).some(p => 
              p.trainingType === "personal" && 
              (p.personalTrainerId === activeStaffId || (!p.personalTrainerId && m.personalTrainerId === activeStaffId))
            );
            return m.personalTrainerId === activeStaffId || hasPTPlan;
          });

          setAssignedMembers(assigned);
          setLoading(false);
        };

        if (isTrainer) {
          getTrainerMembers(gymId, activeStaffId).then(res => {
            if (res.success && res.members) {
              handleMembersData(res.members as Member[]);
            } else {
              console.error("Trainer members fetch error:", res.error);
              setLoading(false);
              toast({ 
                title: "Access Error", 
                description: "Unable to load assigned members. " + (res.error || ""), 
                variant: "destructive" 
              });
            }
          });
        } else {
          unsubMembers = onSnapshot(query(collection(db, "gyms", gymId, "members"), where("personalTrainerId", "==", activeStaffId)), (membersSnap) => {
            const allMembers = membersSnap.docs.map(doc => ({ memberId: doc.id, ...doc.data() } as Member));
            handleMembersData(allMembers);
          }, (error) => {
            console.error("Assigned members listener error:", error);
            setLoading(false);
            toast({ 
              title: "Access Error", 
              description: "Unable to load assigned members. This might be due to permissions.", 
              variant: "destructive" 
            });
          });
        }

      } catch (err) {
        console.error("Staff profile listeners error:", err);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubStaff?.();
      unsubMembers?.();
    };
  }, [gymId, activeStaffId, isTrainer, trainerData, router]);

  const handlePhotoUpdate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !gymId || !staff || isTrainer) return;
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 10MB.", variant: "destructive" });
      return;
    }
    setIsPhotoUpdating(true);
    const { dismiss } = toast({ title: "Updating Photo...", description: "Compressing and uploading.", duration: Infinity });
    try {
      const oldPhotoUrl = staff.photoUrl;
      const photoUrl = await compressAndUploadPhoto(file, gymId, staff.staffId);
      await updateDoc(doc(db, "gyms", gymId, "staff", staff.staffId), { photoUrl });
      if (oldPhotoUrl && oldPhotoUrl.includes("cloudinary.com")) {
        deleteCloudinaryImage(oldPhotoUrl).catch(console.error);
      }
      setStaff(prev => prev ? { ...prev, photoUrl } : null);
      dismiss();
      toast({ title: "Photo Updated" });
    } catch (error) {
      dismiss();
      toast({ title: "Error", description: "Failed to update photo.", variant: "destructive" });
    } finally {
      setIsPhotoUpdating(false);
    }
  };

  const handleEditSave = async () => {
    if (!gymId || !staff || isTrainer) return;
    setIsUpdating(true);
    try {
      const staffRef = doc(db, "gyms", gymId, "staff", staff.staffId);
      const parsedCerts = editForm.certifications.split(",").map(s => s.trim()).filter(Boolean);
      const parsedSpecs = editForm.specialties.split(",").map(s => s.trim()).filter(Boolean);

      const updateData: Record<string, any> = {
        fullName: editForm.fullName,
        email: editForm.email,
        phone: editForm.phone,
        certifications: parsedCerts,
        specialties: parsedSpecs,
        weekSchedule: editForm.weekSchedule.filter(s => s.day && s.startTime && s.endTime),
      };

      if (!isTrainer) {
        updateData.salary = editForm.salary ? Number(editForm.salary) : null;
        updateData.joiningDate = editForm.joiningDate || null;
      }

      if (!/^[6-9]\d{9}$/.test(editForm.phone)) {
        toast({ title: "Invalid Phone", description: "Phone number must be 10 digits and start with 6, 7, 8, or 9.", variant: "destructive" });
        setIsUpdating(false);
        return;
      }

      // Handle notes and history
      if (!isTrainer && editForm.notes !== (staff.notes || "")) {
        updateData.notes = editForm.notes;
        const historyEntry = {
          date: new Date().toISOString(),
          note: staff.notes || ""
        };
        if (staff.notes) {
          updateData.notesHistory = [historyEntry, ...(staff.notesHistory || [])];
        }
      }

      await updateDoc(staffRef, updateData);
      setStaff(prev => prev ? { ...prev, ...updateData } : null);
      toast({ title: "Success", description: "Staff profile updated." });
      setEditOpen(false);
    } catch (error) {
      console.error("Error updating staff:", error);
      toast({ title: "Error", description: "Failed to update staff.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteStaff = async () => {
    if (!gymId || !staff || !user || isTrainer) return;
    setIsDeleting(true);
    const { dismiss } = toast({ title: "Deleting Staff...", description: "Archiving and removing from gym.", duration: Infinity });
    try {
      await archiveStaff(gymId, staff.staffId, user.uid);
      dismiss();
      toast({ title: "Deleted Successfully", description: `${staff.fullName} has been archived.` });
      router.push("/admin/staff");
    } catch (error) {
      dismiss();
      console.error("Error deleting staff:", error);
      toast({ title: "Error", description: "Failed to delete staff member.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const addScheduleDay = () => {
    setEditForm(prev => ({
      ...prev,
      weekSchedule: [...prev.weekSchedule, { day: "", startTime: "09:00", endTime: "17:00" }],
    }));
  };

  const removeScheduleDay = (idx: number) => {
    setEditForm(prev => ({
      ...prev,
      weekSchedule: prev.weekSchedule.filter((_, i) => i !== idx),
    }));
  };

  const updateScheduleDay = (idx: number, field: string, value: string) => {
    setEditForm(prev => ({
      ...prev,
      weekSchedule: prev.weekSchedule.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const handleTrainerLoginSave = async () => {
    if (!user || !gymId || !staff || isTrainer) return;

    setIsSavingTrainerLogin(true);
    try {
      const result = await createOrResetStaffAuth({
        actorUid: user.uid,
        gymId,
        staffId: staff.staffId,
        email: trainerLoginEmail.trim(),
        password: trainerLoginPassword,
      });

      if (!result.success) {
        toast({ title: "Unable to save login", description: result.error, variant: "destructive" });
        return;
      }

      setStaff((prev) => prev ? {
        ...prev,
        trainerLoginEnabled: true,
        trainerLoginEmail: trainerLoginEmail.trim(),
      } : prev);
      setTrainerAccessOpen(false);
      setTrainerLoginPassword("");
      toast({ title: "Trainer login ready", description: result.message || "Trainer login saved successfully." });
    } catch (error) {
      console.error("Error saving trainer login:", error);
      toast({ title: "Error", description: "Failed to save trainer login.", variant: "destructive" });
    } finally {
      setIsSavingTrainerLogin(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex bg-[#0F0F1A] h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  if (!staff) return null;

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case "trainer": return "bg-[#B6916D]/10 text-[#B6916D]";
      case "manager": return "bg-orange-500/20 text-orange-400";
      case "front desk": return "bg-[#B6916D]/10 text-[#B6916D]";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const initials = staff.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();

  // Derive duty days from weekSchedule
  const dutyDays = staff.weekSchedule && staff.weekSchedule.length > 0
    ? staff.weekSchedule.map(s => s.day).join(", ")
    : staff.availability?.days?.join(", ") || "Not set";

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
      {!isTrainer && <AdminSidebar />}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Top Header Row */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            {!isTrainer && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.back()}
                className="hover:bg-[#1C1C1E] text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold">{isTrainer ? "Your Profile" : "Staff Profile"}</h1>
              <p className="text-muted-foreground text-sm">
                {isTrainer ? "View your profile, weekly schedule, and assigned members" : "View details, schedule, and assigned members"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!isTrainer && staff?.role && ["Trainer", "Front Desk"].includes(staff.role) && (
              <Button
                variant="outline"
                className="gap-2 bg-transparent hover:bg-white/[0.04] border-white/[0.08]"
                onClick={() => {
                  setTrainerLoginEmail(staff.trainerLoginEmail || staff.email || "");
                  setTrainerAccessOpen(true);
                }}
              >
                <Phone className="h-4 w-4" />
                {staff.trainerLoginEnabled || staff.staffLoginEnabled ? "Update Login" : "Create Login"}
              </Button>
            )}
            {!isTrainer && (
              <Button onClick={() => setShowDeleteDialog(true)} variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete Staff
              </Button>
            )}
          </div>
        </div>

        {/* Profile Card */}
        <div className="max-w-4xl mx-auto rounded-xl bg-[#1A1A2E]/80 border border-white/[0.08] overflow-hidden shadow-lg mb-8 backdrop-blur-sm">
          {/* Header Section */}
          <div className="p-8 flex flex-col items-center justify-center border-b border-muted/20 relative">
            {!isTrainer && (
              <div className="absolute top-4 right-4 flex items-center gap-2">
                <Button variant="ghost" size="icon" className="text-muted-foreground hover:bg-[#B6916D]/10 hover:text-[#B6916D]" title="Edit Profile" onClick={() => setEditOpen(true)}>
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="relative group mb-4">
              <div className="h-28 w-28 rounded-full overflow-hidden border-4 border-[#131313] shadow-md bg-muted/30 flex items-center justify-center">
                {staff.photoUrl ? (
                  <img src={staff.photoUrl} alt={staff.fullName} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-muted-foreground">{initials}</span>
                )}
              </div>
              {isPhotoUpdating && (
                <div className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#B6916D]" />
                </div>
              )}
              {!isTrainer && (
                <label
                  htmlFor="staff-photo-update"
                  className="absolute bottom-0 right-0 bg-[#B6916D] text-white p-2 rounded-full shadow-lg cursor-pointer hover:scale-110 transition-transform"
                >
                  <Camera className="h-4 w-4" />
                  <input id="staff-photo-update" type="file" accept="image/*" className="hidden" onChange={handlePhotoUpdate} disabled={isPhotoUpdating} />
                </label>
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">{staff.fullName}</h2>
            <span className="text-xs text-muted-foreground font-mono mb-3">ID: {staff.staffId}</span>
            <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${getRoleColor(staff.role)}`}>
              {staff.role}
            </span>
          </div>

          {/* Summary Badges */}
          {(() => {
            const totalPTEarnings = assignedMembers.reduce((sum, member) => {
              const plan = member.activePlan;
              const isPersonalTraining = plan?.trainingType === "personal" || (!plan && member.trainingType === "personal") || member.personalTrainerId === activeStaffId;
              if (!isPersonalTraining) return sum;

              const start = plan?.startDate || member.membershipStartDate;
              const end = plan?.endDate || member.membershipEndDate;
              const amount = plan?.amountPaid ?? member.feesPaid ?? 0;

              let months = 1;
              if (start && end) {
                const diffDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
                months = Math.max(1, Math.round(diffDays / 30));
              } else if (member.membershipType === "quarterly") months = 3;
              else if (member.membershipType === "half-yearly") months = 6;
              else if (member.membershipType === "yearly") months = 12;

              const monthlyFee = amount / months;
              const hasGst = plan?.withGst ?? member.withGst ?? false;
              const gstDeduction = hasGst ? (monthlyFee * 0.05) : 0;
              const baseGymFee = plan?.ptGymFee ?? member.ptGymFee ?? activeGym?.ptGymFee ?? 2000;
              const earnings = Math.max(0, (monthlyFee - baseGymFee - gstDeduction) * 0.5);
              return sum + earnings;
            }, 0);

            const gridCols = staff.role === "Trainer" ? "grid-cols-2 md:grid-cols-4" : (isTrainer ? "grid-cols-2 md:grid-cols-3" : "grid-cols-2 md:grid-cols-4");

            return (
              <div className={`grid ${gridCols} divide-x divide-muted/20 border-b border-muted/20 bg-[#131313]/30`}>
                <div className="p-4 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-[#B6916D]">{assignedMembers.length}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Members</span>
                </div>
                
                {staff.role === "Trainer" && (
                  <div className="p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-bold text-[#10B981] font-mono">₹{totalPTEarnings.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">PT Earnings</span>
                  </div>
                )}

                <div className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold text-foreground truncate max-w-full px-2">{dutyDays}</span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Duty Days</span>
                </div>

                <div className="p-4 flex flex-col items-center justify-center text-center border-t md:border-t-0 border-muted/20">
                  <span className="text-sm font-bold text-foreground">
                    {staff.joiningDate ? new Date(staff.joiningDate).toLocaleDateString() : "N/A"}
                  </span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Joined</span>
                </div>

                {!isTrainer && staff.role !== "Trainer" && (
                  <div className="p-4 flex flex-col items-center justify-center border-t md:border-t-0 border-muted/20">
                    <span className="text-2xl font-bold text-[#B6916D] font-mono">{staff.salary ? `₹${staff.salary.toLocaleString()}` : "N/A"}</span>
                    <span className="text-xs text-muted-foreground uppercase tracking-wide mt-1">Salary</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Details Section */}
          <div className="p-6 space-y-8">
            <div className="flex flex-col md:flex-row gap-8">
              {/* Left Column: Contact & Certs */}
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Contact Information</h3>
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span>{staff.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{staff.phone}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Certifications</h3>
                  <div className="flex flex-wrap gap-2">
                    {staff.certifications && staff.certifications.length > 0 ? (
                      staff.certifications.map(cert => (
                        <span key={cert} className="px-3 py-1 bg-[#B6916D]/10 text-[#B6916D] border border-[#B6916D]/20 rounded-full text-xs font-medium">
                          {cert}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No certifications listed.</span>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Specialties</h3>
                  <div className="flex flex-wrap gap-2">
                    {staff.specialties && staff.specialties.length > 0 ? (
                      staff.specialties.map(spec => (
                        <span key={spec} className="px-3 py-1 bg-muted/50 border border-muted/20 text-foreground rounded-full text-xs font-medium">
                          {spec}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No specialties listed.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Schedule & Assigned Members */}
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Week Schedule</h3>
                  {staff.weekSchedule && staff.weekSchedule.length > 0 ? (
                    <div className="space-y-3">
                      {staff.weekSchedule.map((slot, idx) => (
                        <div key={idx} className="bg-[#131313] p-4 rounded-lg border border-muted/20 flex justify-between items-center">
                          <span className="font-medium text-sm">{slot.day}</span>
                          <span className="text-xs text-muted-foreground">{slot.startTime} – {slot.endTime}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground bg-[#131313] rounded-lg border border-muted/20 border-dashed">
                      <p className="text-sm">No weekly schedule set. Edit profile to add.</p>
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Assigned Members ({assignedMembers.length})</h3>
                  {assignedMembers.length > 0 ? (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {assignedMembers.map(member => {
                    const plan = member.activePlan;
                    const isPersonalTraining = plan?.trainingType === "personal" || (!plan && member.trainingType === "personal") || member.personalTrainerId === activeStaffId;
                    
                    let months = 1;
                    const start = plan?.startDate || member.membershipStartDate;
                    const end = plan?.endDate || member.membershipEndDate;
                    const amount = plan?.amountPaid ?? member.feesPaid ?? 0;

                    if (start && end) {
                      const diffDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
                      months = Math.max(1, Math.round(diffDays / 30));
                    } else {
                      const mType = (plan?.planType || member.membershipType || "").toLowerCase();
                      if (mType.includes("quarterly")) months = 3;
                      else if (mType.includes("half-yearly")) months = 6;
                      else if (mType.includes("yearly")) months = 12;
                    }

                    const monthlyFee = (Number(amount) || 0) / months;
                    // The 'withGst' setting from either the plan itself or the global member profile
                    const hasGst = !!(plan?.withGst || member.withGst);
                    const gstDeduction = hasGst ? (monthlyFee * 0.05) : 0;
                    
                    // Formula: ((Fees / Months) - BaseGymFee - (5% GST if applicable)) * 0.5
                    const baseGymFee = plan?.ptGymFee ?? member.ptGymFee ?? activeGym?.ptGymFee ?? 2000;
                    const trainerEarnings = isPersonalTraining ? Math.max(0, (monthlyFee - baseGymFee - gstDeduction) * 0.5) : 0;

                        return (
                          <div
                            key={member.memberId}
                            className={`bg-[#131313] p-4 rounded-lg border border-muted/20 transition-colors ${isTrainer ? "" : "cursor-pointer hover:border-[#B6916D]/30"}`}
                            onClick={() => {
                              if (!isTrainer) {
                                router.push(`/admin/member/${member.memberId}`);
                              }
                            }}
                          >
                          <div className="flex items-center gap-4 mb-3">
                            <div className="h-10 w-10 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                              {member.photoUrl ? (
                                <img src={member.photoUrl} alt={member.fullName} className="h-full w-full object-cover" />
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground/40" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{member.fullName}</p>
                                <p className="text-xs text-muted-foreground font-mono">{member.memberId}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                new Date(start) > new Date()
                                  ? "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                  : new Date(end) >= new Date()
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-destructive/10 text-destructive border border-destructive/20"
                              }`}>
                                {new Date(start) > new Date() 
                                  ? "Upcoming" 
                                  : new Date(end) >= new Date() 
                                    ? "Active" 
                                    : "Expired"}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 bg-[#0F0F1A]/50 p-3 rounded-md border border-muted/10">
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase block">Start</span>
                                <span className="text-xs font-medium">{new Date(start).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase block">End</span>
                                <span className="text-xs font-medium">{new Date(end).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-muted-foreground uppercase block">Your Earnings/mo</span>
                                <span className="text-xs font-bold text-emerald-400">₹{trainerEarnings.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Total Earnings Summary */}
                      <div className="bg-[#B6916D]/5 p-4 rounded-lg border border-[#B6916D]/20 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-[#B6916D] uppercase tracking-wider">Total Monthly Trainer Earnings</span>
                          <span className="text-lg font-bold text-[#B6916D]">
                            ₹{assignedMembers.reduce((total, member) => {
                              const plan = member.activePlan;
                              const start = plan?.startDate || member.membershipStartDate;
                              const end = plan?.endDate || member.membershipEndDate;
                              const amount = plan?.amountPaid ?? member.feesPaid ?? 0;
                              const withGst = plan?.withGst || (member as any).withGst || false;

                              let months = 1;
                              if (start && end) {
                                const diffDays = Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24)));
                                months = Math.max(1, Math.round(diffDays / 30));
                              } else if (member.membershipType === "quarterly") months = 3;
                              else if (member.membershipType === "half-yearly") months = 6;
                              else if (member.membershipType === "yearly") months = 12;

                              const monthlyFee = amount / months;
                              const gstDeduction = withGst ? (monthlyFee * 0.05) : 0;
                              const baseGymFee = plan?.ptGymFee ?? member?.ptGymFee ?? activeGym?.ptGymFee ?? 2000;
                              return total + Math.max(0, (monthlyFee - baseGymFee - gstDeduction) * 0.5);
                            }, 0).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-muted-foreground bg-[#131313] rounded-lg border border-muted/20 border-dashed">
                      <p className="text-sm">No members assigned for personal training.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Admin Notes Section */}
            {!isTrainer && (
            <div className="mt-8 border-t border-muted/20 pt-8">
              <div className="flex items-center gap-2 mb-4">
                <Edit className="h-4 w-4 text-[#B6916D]" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Internal Notes</h3>
              </div>
              <div className="bg-[#131313]/50 p-6 rounded-xl border border-muted/10 min-h-[100px] relative overflow-hidden mb-6">
                <div className="absolute top-0 left-0 w-1 h-full bg-[#B6916D]/30"></div>
                <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed italic">
                  {staff.notes || "No internal notes for this staff member."}
                </p>
              </div>

              {staff.notesHistory && staff.notesHistory.length > 0 && (
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-[#8888A0] uppercase tracking-wider">Previous Notes History</h4>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {staff.notesHistory.map((history, idx) => (
                      <div key={idx} className="bg-[#131313]/30 p-4 rounded-lg border border-muted/10 relative">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {new Date(history.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                          </span>
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
            )}
          </div>
        </div>
      </main>

      {/* Edit Profile Dialog */}
      {!isTrainer && <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#1C1C1E] border-muted/20 text-foreground">
          <DialogHeader>
            <DialogTitle>Edit Staff Profile</DialogTitle>
            <DialogDescription>Update staff details, salary, and schedule.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Full Name</Label>
                <Input className="bg-[#131313] border-muted/20" value={editForm.fullName} onChange={e => setEditForm(p => ({ ...p, fullName: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input className="bg-[#131313] border-muted/20" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <Input className="bg-[#131313] border-muted/20" value={editForm.phone} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
              </div>
              {!isTrainer && (
                <>
                  <div className="space-y-1.5">
                    <Label>Salary (₹ / month)</Label>
                    <Input className="bg-[#131313] border-muted/20" type="number" value={editForm.salary} onChange={e => setEditForm(p => ({ ...p, salary: e.target.value }))} placeholder="e.g. 25000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Joining Date</Label>
                    <Input className="bg-[#131313] border-muted/20" type="date" value={editForm.joiningDate} onChange={e => setEditForm(p => ({ ...p, joiningDate: e.target.value }))} />
                  </div>
                </>
              )}
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Certifications (comma separated)</Label>
                <Input className="bg-[#131313] border-muted/20" value={editForm.certifications} onChange={e => setEditForm(p => ({ ...p, certifications: e.target.value }))} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Specialties (comma separated)</Label>
                <Input className="bg-[#131313] border-muted/20" value={editForm.specialties} onChange={e => setEditForm(p => ({ ...p, specialties: e.target.value }))} />
              </div>
              {!isTrainer && (
                <div className="space-y-1.5 sm:col-span-2">
                  <Label>Internal Notes</Label>
                  <textarea 
                    className="w-full min-h-[100px] p-3 rounded-md bg-[#131313] border border-muted/20 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-muted-foreground/30"
                    value={editForm.notes}
                    onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Week Schedule */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Week Schedule</Label>
                <Button type="button" variant="outline" size="sm" className="text-xs bg-[#131313] border-muted/20" onClick={addScheduleDay}>
                  + Add Day
                </Button>
              </div>
              {editForm.weekSchedule.map((slot, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Day</Label>
                    <select
                      value={slot.day}
                      onChange={e => updateScheduleDay(idx, "day", e.target.value)}
                      className="w-full h-10 px-3 rounded-md border border-muted/20 bg-[#131313] text-sm text-foreground"
                    >
                      <option value="">Select</option>
                      {DAYS_OF_WEEK.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input className="bg-[#131313] border-muted/20" type="time" value={slot.startTime} onChange={e => updateScheduleDay(idx, "startTime", e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input className="bg-[#131313] border-muted/20" type="time" value={slot.endTime} onChange={e => updateScheduleDay(idx, "endTime", e.target.value)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 mb-0.5" onClick={() => removeScheduleDay(idx)}>
                    ×
                  </Button>
                </div>
              ))}
              {editForm.weekSchedule.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3 bg-[#131313] rounded-lg border border-dashed border-muted/20">No schedule days added.</p>
              )}
            </div>

            <div className="flex justify-end pt-4 border-t border-muted/20">
              <Button disabled={isUpdating} className="w-full sm:w-auto bg-[#B6916D] hover:bg-[#B6916D]/90 text-white" onClick={handleEditSave}>
                {isUpdating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>}

      {/* Delete Confirmation Dialog */}
      {!isTrainer && <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-[#1C1C1E] border-white/[0.08] text-white">
          <DialogHeader>
            <DialogTitle className="text-destructive">Are you absolutely sure?</DialogTitle>
            <DialogDescription className="text-[#8888A0]">
              This will archive {staff.fullName} and remove them from the gym. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)} className="bg-transparent border-white/[0.08] hover:bg-white/[0.04]">Cancel</Button>
            <Button onClick={handleDeleteStaff} className="bg-destructive hover:bg-destructive/90 text-white">
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}

      {!isTrainer && staff?.role && ["Trainer", "Front Desk"].includes(staff.role) && (
        <Dialog open={trainerAccessOpen} onOpenChange={setTrainerAccessOpen}>
          <DialogContent className="bg-[#1C1C1E] border-white/[0.08] text-white">
            <DialogHeader>
              <DialogTitle>
                {staff.trainerLoginEnabled || staff.staffLoginEnabled ? `Reset ${staff.role} Login` : `Create ${staff.role} Login`}
              </DialogTitle>
              <DialogDescription className="text-[#8888A0]">
                {staff.role === "Trainer" 
                  ? "This trainer will only be able to open and edit their own profile page." 
                  : "This front desk staff will receive access to the gym dashboard."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 text-sm">
                <p className="font-medium text-white">{staff.fullName}</p>
                <p className="text-[#8888A0]">Staff ID: {staff.staffId}</p>
                <p className="text-[#8888A0] mt-1">Login page: {staff.role === "Trainer" ? "/trainer/login" : "/front-desk/login"}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="trainer-login-email">Login Email</Label>
                <Input
                  id="trainer-login-email"
                  type="email"
                  value={trainerLoginEmail}
                  onChange={(e) => setTrainerLoginEmail(e.target.value)}
                  className="bg-[#131313] border-white/[0.08]"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="trainer-login-password">Password</Label>
                <Input
                  id="trainer-login-password"
                  type="password"
                  value={trainerLoginPassword}
                  onChange={(e) => setTrainerLoginPassword(e.target.value)}
                  className="bg-[#131313] border-white/[0.08]"
                  placeholder="At least 6 chars, with upper/lower/number/special"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setTrainerAccessOpen(false)} className="bg-transparent border-white/[0.08] hover:bg-white/[0.04]">
                Cancel
              </Button>
              <Button onClick={handleTrainerLoginSave} disabled={isSavingTrainerLogin} className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white">
                {isSavingTrainerLogin ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                {staff.trainerLoginEnabled ? "Update Login" : "Create Login"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
