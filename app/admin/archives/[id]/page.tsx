"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { addDoc, collection, doc, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { Loader2, ArrowLeft, RotateCcw, ShieldAlert } from "lucide-react";

import AdminSidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { ArchivedMember, Member } from "@/types";

const planOptions: { value: Member["membershipType"]; label: string; days: number }[] = [
  { value: "monthly", label: "Monthly (30 days)", days: 30 },
  { value: "quarterly", label: "Quarterly (90 days)", days: 90 },
  { value: "half-yearly", label: "Half-Yearly (180 days)", days: 180 },
  { value: "yearly", label: "Yearly (365 days)", days: 365 },
  { value: "trial", label: "Trial (1 day)", days: 1 },
  { value: "other", label: "Custom (set end date)", days: 0 },
];

function calculateEndDate(startDateStr: string, type: Member["membershipType"]) {
  if (!startDateStr) return "";
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) return "";
  const option = planOptions.find((p) => p.value === type);
  if (!option) return "";
  if (option.days === 0) return "";
  const end = new Date(start);
  end.setDate(end.getDate() + option.days);
  return end.toISOString().split("T")[0];
}

export default function ArchivedMemberDetail() {
  const { id } = useParams();
  const router = useRouter();
  const { adminData, frontDeskData, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const gymId = adminData?.gymId || frontDeskData?.gymId;

  const [archived, setArchived] = useState<ArchivedMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<Member["membershipType"]>("monthly");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [fees, setFees] = useState("");
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    if (!gymId || !id) return;
    const fetchArchive = async () => {
      try {
        const ref = doc(db, "archives", gymId, "members", id as string);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const data = snap.data() as ArchivedMember;
          setArchived({ ...data, memberId: snap.id });
          // Default plan suggestion based on last plan
          setPlan((data.membershipType as Member["membershipType"]) || "monthly");
          const defaultStart = new Date().toISOString().split("T")[0];
          setStartDate(defaultStart);
          setEndDate(calculateEndDate(defaultStart, (data.membershipType as Member["membershipType"]) || "monthly"));
        }
      } finally {
        setLoading(false);
      }
    };
    fetchArchive();
  }, [gymId, id]);

  useEffect(() => {
    setEndDate(calculateEndDate(startDate, plan));
  }, [startDate, plan]);

  const planHistoryPreview = useMemo(() => {
    if (!archived) return [];
    const lastPlan = {
      planType: archived.membershipType,
      startDate: archived.membershipStartDate,
      endDate: archived.membershipEndDate,
      amountPaid: archived.feesPaid || 0,
      archivedAt: archived.archivedAt,
    };
    return [...(archived.planHistory || []), lastPlan].filter((p) => p.startDate && p.endDate);
  }, [archived]);

  const handleRestore = async () => {
    if (!gymId || !archived || !startDate) return;
    setRestoring(true);
    try {
      const memberId = archived.memberId;
      const history = planHistoryPreview;

      const { archivedAt, archivedBy, archiveType, originalGymId, ...rest } = archived;
      const payload: Member = {
        ...(rest as unknown as Member),
        memberId,
        gymId,
        membershipType: plan,
        membershipStartDate: startDate,
        membershipEndDate: endDate || startDate,
        feesPaid: Number(fees) || 0,
        planHistory: history,
        isArchived: false,
      };

      await setDoc(doc(db, "gyms", gymId, "members", memberId), payload);

      if (Number(fees) > 0) {
        await addDoc(collection(db, "gyms", gymId, "payments"), {
          memberId,
          amount: Number(fees),
          date: new Date().toISOString(),
          type: "reactivated_fee",
        });
      }

      await deleteDoc(doc(db, "archives", gymId, "members", memberId));

      toast({
        title: "Member restored",
        description: "Profile moved back to active members with updated plan.",
      });
      router.push(`/admin/member/${memberId}`);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to restore member.", variant: "destructive" });
    } finally {
      setRestoring(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!archived) {
    return (
      <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
        <AdminSidebar />
        <main className="flex-1 p-8 flex flex-col items-center justify-center">
          <p className="text-lg font-semibold text-muted-foreground">Archived member not found.</p>
          <Button variant="link" onClick={() => router.back()}>Go back</Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="flex items-center justify-between gap-4 mb-8 pt-12 lg:pt-0 border-b border-muted/20 pb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="hover:bg-[#1C1C1E]">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Restore Archived Member</h1>
              <p className="text-muted-foreground text-sm">Bring {archived.fullName} back to active members.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-amber-300 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-md">
            <ShieldAlert className="h-4 w-4" />
            Archived on {archived.archivedAt ? new Date(archived.archivedAt).toLocaleDateString() : "unknown"}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
          <Card className="bg-[#1A1A2E]/80 border-white/[0.08]">
            <CardHeader>
              <CardTitle>Member Snapshot</CardTitle>
              <CardDescription>Read-only details from the time of deletion.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Full Name</p>
                <p className="font-semibold">{archived.fullName}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Member ID</p>
                <p className="font-mono">{archived.memberId}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Email</p>
                <p className="font-medium">{archived.email}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Phone</p>
                <p className="font-medium">{archived.phone}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last Plan</p>
                <p className="capitalize font-medium">{archived.membershipType}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Last Expiry</p>
                <p className="font-medium">
                  {archived.membershipEndDate
                    ? new Date(archived.membershipEndDate).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#111322] border-white/[0.08]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-primary" />
                Reactivate & Add New Plan
              </CardTitle>
              <CardDescription>Set a new start date, plan, and fees to reopen this profile.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Membership Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#0F0F1A] border-white/[0.08]"
                />
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <select
                  value={plan}
                  onChange={(e) => setPlan(e.target.value as Member["membershipType"])}
                  className="w-full h-10 px-3 rounded-md border border-white/[0.08] bg-[#0F0F1A] text-sm"
                >
                  {planOptions.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Calculated End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  disabled={plan !== "other"}
                  className="bg-[#0F0F1A] border-white/[0.08]"
                />
                {plan !== "other" && (
                  <p className="text-xs text-muted-foreground">End date auto-fills based on plan. Choose "Custom" to override.</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Fees to record now (₹)</Label>
                <Input
                  type="number"
                  min="0"
                  value={fees}
                  onChange={(e) => setFees(e.target.value)}
                  placeholder="e.g. 1500"
                  className="bg-[#0F0F1A] border-white/[0.08]"
                />
              </div>
              <Button
                onClick={handleRestore}
                disabled={restoring}
                className="w-full bg-[#10B981] hover:bg-[#10B981]/90 text-white"
              >
                {restoring ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Restore Member
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6 bg-[#1A1A2E]/60 border-white/[0.06]">
          <CardHeader>
            <CardTitle>Past Memberships</CardTitle>
            <CardDescription>Historical plans saved from the previous profile.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-white/[0.06]">
            {planHistoryPreview.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No past plans recorded.</p>
            ) : (
              planHistoryPreview.map((p, idx) => (
                <div key={idx} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold capitalize">{p.planType}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.startDate ? new Date(p.startDate).toLocaleDateString() : "—"} →{" "}
                      {p.endDate ? new Date(p.endDate).toLocaleDateString() : "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">₹{(p as any).amountPaid || 0}</p>
                    {(p as any).archivedAt && (
                      <p className="text-[11px] text-muted-foreground">archived {new Date((p as any).archivedAt).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
