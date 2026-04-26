"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Inquiry } from "@/types";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Eye, Trash2, CheckCircle2, ChevronLeft, ChevronRight, UserPlus, Calendar } from "lucide-react";
import { db } from "@/lib/firebase/config";
import { doc, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/hooks/use-toast";

interface InquiryTableProps {
  inquiries: Inquiry[];
  title: string;
  onConvert?: (inquiry: Inquiry) => void;
  hideActions?: boolean;
}

export default function InquiryTable({ inquiries, title, onConvert, hideActions }: InquiryTableProps) {
  const router = useRouter();
  const { adminData } = useAuth();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const totalPages = Math.max(1, Math.ceil(inquiries.length / itemsPerPage));
  
  const currentInquiries = inquiries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleDelete = async (id: string, name: string) => {
    if (!adminData) return;
    if (!confirm(`Are you sure you want to delete the inquiry for ${name}?`)) return;

    try {
      await deleteDoc(doc(db, "gyms", adminData.gymId, "inquiries", id));
      toast({ title: "Deleted", description: "Inquiry has been removed." });
    } catch (err) {
      console.error("Delete inquiry error:", err);
      toast({ title: "Error", description: "Failed to delete inquiry.", variant: "destructive" });
    }
  };

  const getReminderStatus = (reminderDate?: string) => {
    if (!reminderDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(reminderDate);
    date.setHours(0, 0, 0, 0);

    if (date < today) return <Badge variant="destructive" className="text-[10px]">Overdue</Badge>;
    if (date.getTime() === today.getTime()) return <Badge variant="default" className="bg-amber-500 text-[10px]">Today</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Upcoming</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <Badge variant="outline" className="text-white border-white/10">{inquiries.length} Inquiries</Badge>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-white/[0.02]">
            <TableRow className="border-b border-white/[0.06] hover:bg-transparent">
              <TableHead className="text-muted-foreground font-medium h-12 px-4">Member</TableHead>
              <TableHead className="text-muted-foreground font-medium">Phone</TableHead>
              <TableHead className="text-muted-foreground font-medium">Latest Notes</TableHead>
              <TableHead className="text-muted-foreground font-medium">Reminder</TableHead>
              <TableHead className="text-muted-foreground font-medium">Status</TableHead>
              <TableHead className="text-muted-foreground font-medium">Created At</TableHead>
              <TableHead className="text-right text-muted-foreground font-medium px-4">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentInquiries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No inquiries found.
                </TableCell>
              </TableRow>
            ) : (
              currentInquiries.map((inquiry) => (
                <TableRow key={inquiry.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                  <TableCell className="px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 overflow-hidden flex items-center justify-center shrink-0">
                        {inquiry.photoUrl ? (
                          <img src={inquiry.photoUrl} alt={inquiry.fullName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-medium text-emerald-500">{inquiry.fullName.substring(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-sm text-white">{inquiry.fullName}</span>
                        {inquiry.nickname && <span className="text-[10px] text-muted-foreground">({inquiry.nickname})</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{inquiry.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={inquiry.notes}>
                    {inquiry.notes}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      {inquiry.reminderDate ? (
                        <>
                          <span className="text-xs text-white">{format(new Date(inquiry.reminderDate), "MMM dd")}</span>
                          {getReminderStatus(inquiry.reminderDate)}
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={inquiry.status === "converted" ? "default" : "secondary"}
                      className={inquiry.status === "converted" ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30" : "bg-white/5 text-muted-foreground"}
                    >
                      {inquiry.status === "converted" ? "Converted" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {format(new Date(inquiry.createdAt), "MMM dd, yyyy")}
                  </TableCell>
                  <TableCell className="text-right px-4">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-white"
                        onClick={() => router.push(`/admin/inquiries/${inquiry.id}`)}
                        title="View Details & History"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {!hideActions && inquiry.status !== "converted" && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => onConvert?.(inquiry)}
                            title="Convert to Member"
                          >
                            <UserPlus className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-destructive hover:text-red-400 hover:bg-destructive/10"
                            onClick={() => handleDelete(inquiry.id, inquiry.fullName)}
                            title="Delete Inquiry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] text-sm">
            <div className="text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, inquiries.length)} of {inquiries.length} Inquiries
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/[0.08] hover:bg-white/[0.04]"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 border-white/[0.08] hover:bg-white/[0.04]"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
