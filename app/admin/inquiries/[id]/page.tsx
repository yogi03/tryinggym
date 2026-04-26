"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, updateDoc, deleteDoc, collection, query } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Inquiry, Staff } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import AdminSidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Calendar, 
  MapPin, 
  MessageSquare, 
  UserPlus, 
  Trash2, 
  Clock,
  CheckCircle2,
  Loader2,
  Camera
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import AddMemberDialog from "@/components/admin/dashboard/AddMemberDialog";

export default function InquiryDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { adminData, frontDeskData } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [inquiry, setInquiry] = useState<Inquiry | null>(null);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [newReminder, setNewReminder] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);

  useEffect(() => {
    if (!gymId || !id) return;

    setLoading(true);
    setInquiry(null);
    setStaff([]);

    const unsubInquiry = onSnapshot(doc(db, "gyms", gymId, "inquiries", id as string), (doc) => {
      if (doc.exists()) {
        setInquiry({ id: doc.id, ...doc.data() } as Inquiry);
        setNewReminder(doc.data().reminderDate || "");
      } else {
        toast({ title: "Not Found", description: "Inquiry not found.", variant: "destructive" });
        router.push("/admin/inquiries");
      }
      setLoading(false);
    });

    const staffRef = collection(db, "gyms", gymId, "staff");
    const unsubscribeStaff = onSnapshot(query(staffRef), (snapshot) => {
      const data = snapshot.docs.map(d => ({ staffId: d.id, ...d.data() })) as Staff[];
      setStaff(data);
    });

    return () => {
      unsubInquiry();
      unsubscribeStaff();
    };
  }, [gymId, id, router]);

  const handleAddFollowUp = async () => {
    if (!gymId || !inquiry || !newNote) return;

    setIsUpdating(true);
    try {
      const now = new Date().toISOString();
      const updatedHistory = [
        ...(inquiry.notesHistory || []),
        { date: now, note: newNote }
      ];

      await updateDoc(doc(db, "gyms", gymId, "inquiries", inquiry.id), {
        notes: newNote, // Latest note
        notesHistory: updatedHistory,
        reminderDate: newReminder,
        updatedAt: now
      });

      setNewNote("");
      toast({ title: "Updated", description: "Follow-up note added." });
    } catch (err) {
      console.error("Update inquiry error:", err);
      toast({ title: "Error", description: "Failed to update inquiry.", variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!gymId || !inquiry) return;
    if (!confirm(`Are you sure you want to delete the inquiry for ${inquiry.fullName}?`)) return;

    try {
      await deleteDoc(doc(db, "gyms", gymId, "inquiries", inquiry.id));
      toast({ title: "Deleted", description: "Inquiry has been removed." });
      router.push("/admin/inquiries");
    } catch (err) {
      console.error("Delete inquiry error:", err);
      toast({ title: "Error", description: "Failed to delete inquiry.", variant: "destructive" });
    }
  };

  const handleConvertSuccess = async (memberId: string) => {
    if (!gymId || !inquiry) return;
    try {
      await updateDoc(doc(db, "gyms", gymId, "inquiries", inquiry.id), {
        status: "converted",
        conversionDate: new Date().toISOString(),
        convertedToMemberId: memberId,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Success", description: "Inquiry converted to member." });
    } catch (err) { console.error(err); }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#0F0F1A]">
        <AdminSidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
        </div>
      </div>
    );
  }

  if (!inquiry) return null;

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-6 pt-14 lg:pt-0">
          
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to List
          </button>

          <div className="flex flex-col md:flex-row gap-6">
            {/* Left Column: Details */}
            <div className="flex-1 space-y-6">
              <div className="p-6 rounded-2xl bg-[#1A1A2E]/80 backdrop-blur-sm border border-white/[0.06] relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <Badge 
                    variant={inquiry.status === "converted" ? "default" : "secondary"}
                    className={inquiry.status === "converted" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" : "bg-[#B6916D]/20 text-[#B6916D] border-[#B6916D]/30"}
                  >
                    {inquiry.status === "converted" ? "Converted" : "Pending Inquiry"}
                  </Badge>
                </div>

                <div className="flex items-start gap-6">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#B6916D]/20 to-[#B6916D]/5 border border-[#B6916D]/20 flex items-center justify-center overflow-hidden shrink-0">
                    {inquiry.photoUrl ? (
                      <img src={inquiry.photoUrl} alt={inquiry.fullName} className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="h-8 w-8 text-[#B6916D]/40" />
                    )}
                  </div>
                  <div className="space-y-1 pt-2">
                    <h2 className="text-2xl font-bold text-white">{inquiry.fullName}</h2>
                    {inquiry.nickname && <p className="text-[#B6916D] text-sm font-medium">"{inquiry.nickname}"</p>}
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                      <div className="flex items-center gap-2 text-sm text-[#8888A0]"><Phone className="h-4 w-4" />{inquiry.phone}</div>
                      {inquiry.email && <div className="flex items-center gap-2 text-sm text-[#8888A0]"><Mail className="h-4 w-4" />{inquiry.email}</div>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-8 pt-6 border-t border-white/[0.04]">
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Interest</p>
                    <p className="text-sm font-medium text-white">{inquiry.membershipType || "Not Specified"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Training</p>
                    <p className="text-sm font-medium text-white capitalize">{inquiry.trainingType || "General"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Gender</p>
                    <p className="text-sm font-medium text-white capitalize">{inquiry.gender || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Address</p>
                    <p className="text-sm font-medium text-white flex items-center gap-1"><MapPin className="h-3 w-3 text-[#B6916D]" />{inquiry.address || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Created</p>
                    <p className="text-sm font-medium text-white">{format(new Date(inquiry.createdAt), "MMM dd, yyyy")}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Goals</p>
                    <p className="text-sm font-medium text-white">{inquiry.fitnessGoals || "—"}</p>
                  </div>
                </div>
              </div>

              {/* Follow-up History */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#B6916D]" />
                    Note History
                  </h3>
                  <Badge variant="outline" className="text-xs">{inquiry.notesHistory?.length || 0} Notes</Badge>
                </div>

                <div className="space-y-4">
                  {(inquiry.notesHistory || []).slice().reverse().map((note, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2 relative ml-4">
                      <div className="absolute -left-10 top-6 w-4 h-4 rounded-full bg-[#B6916D]/20 border border-[#B6916D]/40 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#B6916D]" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-[#B6916D] uppercase">{format(new Date(note.date), "MMM dd, yyyy • hh:mm a")}</span>
                      </div>
                      <p className="text-sm text-[#8888A0] leading-relaxed italic">"{note.note}"</p>
                    </div>
                  ))}
                  {(!inquiry.notesHistory || inquiry.notesHistory.length === 0) && (
                    <p className="text-center py-8 text-muted-foreground text-sm">No follow-up history recorded yet.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Next Steps */}
            <div className="w-full md:w-80 space-y-6 shrink-0">
              {inquiry.status !== "converted" && (
                <Card className="bg-[#1A1A2E]/80 border-white/[0.06] shadow-xl">
                  <CardHeader>
                    <CardTitle className="text-lg text-white">Add Follow-up</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-[#8888A0]">Conversation Note</Label>
                      <Textarea 
                        placeholder="What was the result of today's talk?" 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08] min-h-[100px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-[#8888A0]">Next Follow-up Reminder</Label>
                      <Input 
                        type="date"
                        value={newReminder}
                        onChange={(e) => setNewReminder(e.target.value)}
                        className="bg-white/[0.04] border-white/[0.08]"
                      />
                    </div>
                    <Button 
                      onClick={handleAddFollowUp}
                      disabled={!newNote || isUpdating}
                      className="w-full bg-[#B6916D] hover:bg-[#B6916D]/90 text-white gap-2"
                    >
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
                      Save Follow-up
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-3">
                {inquiry.status !== "converted" && (
                  <Button 
                    variant="outline" 
                    className="w-full border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/10 gap-2 h-12 text-sm font-bold uppercase transition-all"
                    onClick={() => setShowConvertDialog(true)}
                  >
                    <UserPlus className="h-4 w-4" />
                    Convert to Member
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  className="w-full text-destructive hover:bg-destructive/10 gap-2 h-10 text-xs font-semibold"
                  onClick={handleDelete}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete Inquiry
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AddMemberDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        staff={staff}
        initialData={{
          fullName: inquiry.fullName,
          phone: inquiry.phone,
          email: inquiry.email || "",
          gender: inquiry.gender,
          dob: inquiry.dob || "",
          address: inquiry.address || "",
          membershipType: (inquiry.membershipType as any) || "monthly",
          trainingType: inquiry.trainingType || "general",
          notes: inquiry.notes || "",
          feesPaid: inquiry.feesPaid?.toString() || "",
          paymentOption: (inquiry.paymentOption as any) || "cash",
          nickname: inquiry.nickname || "",
          fitnessGoals: inquiry.fitnessGoals || "",
          healthAssessment: inquiry.healthAssessment || ""
        }}
        onSuccess={handleConvertSuccess}
      />
    </div>
  );
}
