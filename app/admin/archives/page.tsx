"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { Archive, Loader2, Search } from "lucide-react";

import AdminSidebar from "@/components/admin/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { ArchivedMember } from "@/types";

export default function ArchivedMembersPage() {
  const { adminData, frontDeskData, loading: authLoading } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const router = useRouter();
  const [archived, setArchived] = useState<ArchivedMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!gymId) return;
    setLoading(true);
    setArchived([]);
    let cancelled = false;

    const fetchData = async () => {
      try {
        const snapshot = await getDocs(query(collection(db, "archives", gymId, "members"), orderBy("archivedAt", "desc")));
        if (cancelled) return;
        const data = snapshot.docs.map((doc) => ({
          ...(doc.data() as ArchivedMember),
          memberId: doc.id,
        }));
        setArchived(data);
      } catch (error) {
        console.error("Archives fetch error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [gymId]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return archived.filter((m) =>
      [m.fullName, m.email, m.phone, m.memberId].some((field) =>
        (field || "").toLowerCase().includes(term)
      )
    );
  }, [archived, search]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pt-12 lg:pt-0 border-b border-muted/20 pb-4">
          <div className="flex items-center gap-3">
            {/* <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <Archive className="h-5 w-5 text-primary" />
            </div> */}
            <div>
              <h1 className="text-2xl font-bold">Archived Members</h1>
              <p className="text-muted-foreground text-sm">
                Previously deleted members. Reactivate from here to preserve their history.
              </p>
            </div>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search archived members..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-[#111322] border-white/[0.08] focus-visible:ring-1 focus-visible:ring-[#10B981]"
            />
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-transparent">
              <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Member</TableHead>
                <TableHead className="text-muted-foreground font-medium">Contact</TableHead>
                <TableHead className="text-muted-foreground font-medium">Plan</TableHead>
                <TableHead className="text-muted-foreground font-medium">Expiry</TableHead>
                <TableHead className="text-muted-foreground font-medium">Archived On</TableHead>
                <TableHead className="text-right text-muted-foreground font-medium pr-6">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    No archived members found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((member) => (
                  <TableRow
                    key={member.memberId}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                  >
                    <TableCell className="font-semibold">{member.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground space-y-0.5">
                      <div>{member.email}</div>
                      <div className="font-mono text-xs text-muted-foreground/80">
                        {member.phone}
                      </div>
                    </TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">
                      {member.membershipType}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.membershipEndDate
                        ? new Date(member.membershipEndDate).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {member.archivedAt
                        ? new Date(member.archivedAt).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-[#111322] border-white/[0.08] text-primary hover:border-primary"
                        onClick={() => router.push(`/admin/archives/${member.memberId}`)}
                      >
                        View / Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
