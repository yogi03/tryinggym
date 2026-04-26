"use client";

import { useEffect, useState } from "react";
import { collection, query, doc, updateDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase/config";
import { Inquiry, Staff } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import AdminSidebar from "@/components/admin/Sidebar";
import InquiryTable from "@/components/admin/inquiry/InquiryTable";
import AddInquiryDialog from "@/components/admin/inquiry/AddInquiryDialog";
import AddMemberDialog from "@/components/admin/dashboard/AddMemberDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Loader2, 
  Filter,
  X,
  ChevronDown,
  UserCheck
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function InquiryListing() {
  const { adminData, frontDeskData } = useAuth();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Status");
  const [showAddInquiry, setShowAddInquiry] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);

  useEffect(() => {
    if (!gymId) return;

    setLoading(true);
    let unsubInquiries: (() => void) | undefined;
    let unsubStaff: (() => void) | undefined;

    const setupListeners = () => {
      try {
        // 1. Inquiries Listener
        unsubInquiries = onSnapshot(query(collection(db, "gyms", gymId, "inquiries")), (snapshot) => {
          setInquiries(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Inquiry[]);
          setLoading(false);
        });

        // 2. Staff Listener
        unsubStaff = onSnapshot(query(collection(db, "gyms", gymId, "staff")), (snapshot) => {
          setStaff(snapshot.docs.map(d => ({ staffId: d.id, ...d.data() })) as Staff[]);
        });

      } catch (error) {
        console.error("Inquiries page listeners error:", error);
        setLoading(false);
      }
    };

    setupListeners();

    return () => {
      unsubInquiries?.();
      unsubStaff?.();
    };
  }, [gymId]);

  const filteredInquiries = inquiries.filter(inq => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      inq.fullName.toLowerCase().includes(searchLower) ||
      inq.phone.includes(searchTerm) ||
      (inq.email && inq.email.toLowerCase().includes(searchLower));

    const matchesStatus = 
      statusFilter === "Status" || 
      (statusFilter === "Pending" && inq.status !== "converted") ||
      (statusFilter === "Converted" && inq.status === "converted");

    return matchesSearch && matchesStatus;
  });

  const handleOpenConvert = (inquiry: Inquiry) => {
    setSelectedInquiry(inquiry);
    setShowConvertDialog(true);
  };

  const handleConvertSuccess = async (memberId: string) => {
    if (!gymId || !selectedInquiry) return;
    
    try {
      await updateDoc(doc(db, "gyms", gymId, "inquiries", selectedInquiry.id), {
        status: "converted",
        conversionDate: new Date().toISOString(),
        convertedToMemberId: memberId,
        updatedAt: new Date().toISOString()
      });
      toast({ title: "Inquiry Converted", description: "The inquiry has been marked as converted." });
    } catch (err) {
      console.error("Update inquiry status error:", err);
    }
  };

  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("Status");
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

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto space-y-6 pt-14 lg:pt-0">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">Inquiry Management</h1>
              <p className="text-[#8888A0] text-sm">Track and convert potential members</p>
            </div>
            <Button 
              onClick={() => setShowAddInquiry(true)}
              className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white gap-2 h-10"
            >
              <Plus className="h-4 w-4" />
              Add Inquiry
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl">
              <p className="text-xs text-[#8888A0] uppercase font-semibold">Total Inquiries</p>
              <p className="text-2xl font-bold text-white mt-1">{inquiries.length}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl">
              <p className="text-xs text-[#8888A0] uppercase font-semibold">Pending Leads</p>
              <p className="text-2xl font-bold text-[#B6916D] mt-1">{inquiries.filter(i => i.status !== "converted").length}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl">
              <p className="text-xs text-[#8888A0] uppercase font-semibold">Converted</p>
              <p className="text-2xl font-bold text-blue-500 mt-1">{inquiries.filter(i => i.status === "converted").length}</p>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.08] p-4 rounded-xl">
              <p className="text-xs text-[#8888A0] uppercase font-semibold">Conversion Rate</p>
              <p className="text-2xl font-bold text-amber-500 mt-1">
                {inquiries.length > 0 ? Math.round((inquiries.filter(i => i.status === "converted").length / inquiries.length) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="bg-[#0F0F1A] border border-white/[0.08] rounded-xl p-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="relative flex-1 min-w-[200px] max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search inquiries..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white/[0.04] border-white/[0.08] h-10 w-full rounded-md focus-visible:ring-1 focus-visible:ring-[#B6916D]"
                />
              </div>

              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger render={<Button variant="outline" className="bg-white/[0.04] border-white/[0.08] text-white hover:bg-white/[0.08] h-10" />}>
                    <Filter className="h-4 w-4 mr-2" /> Filters <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-4 bg-[#0F0F1A] border border-white/[0.08] text-white rounded-xl shadow-xl z-50 pointer-events-auto" align="end">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Filter Inquiries</h4>
                        {(searchTerm || statusFilter !== "Status") && (
                          <button onClick={clearFilters} className="text-xs text-[#B6916D] hover:underline">Reset</button>
                        )}
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-xs text-[#8888A0]">Status</label>
                        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "Status")}>
                          <SelectTrigger className="w-full h-9 bg-white/[0.04] border-white/[0.08]">
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                            <SelectItem value="Status">All Status</SelectItem>
                            <SelectItem value="Pending">Pending Leads</SelectItem>
                            <SelectItem value="Converted">Converted Only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {(searchTerm || statusFilter !== "Status") && (
              <div className="mt-4 pt-4 border-t border-white/[0.08] flex items-center flex-wrap gap-2 text-sm">
                <span className="text-[#8888A0] mr-2">Active filters:</span>
                
                {statusFilter !== "Status" && (
                  <Badge variant="secondary" className="bg-[#B6916D]/10 text-[#B6916D] hover:bg-[#B6916D]/20 rounded-md border-[#B6916D]/20 px-2 py-1">
                    Status: {statusFilter}
                    <button onClick={() => setStatusFilter("Status")} className="ml-2 hover:text-white"><X className="h-3 w-3" /></button>
                  </Badge>
                )}

                {searchTerm && (
                  <Badge variant="secondary" className="bg-white/5 text-white hover:bg-white/10 rounded-md border-white/10 px-2 py-1">
                    Search: {searchTerm}
                    <button onClick={() => setSearchTerm("")} className="ml-2 hover:text-[#B6916D]"><X className="h-3 w-3" /></button>
                  </Badge>
                )}

                <button onClick={clearFilters} className="ml-auto text-xs text-[#B6916D] font-medium hover:underline">
                  Clear all
                </button>
              </div>
            )}
          </div>

          <div className="mt-6">
            <InquiryTable 
              inquiries={filteredInquiries} 
              title={statusFilter === "Converted" ? "Converted History" : "Current Inquiries"} 
              onConvert={handleOpenConvert}
              hideActions={statusFilter === "Converted"}
            />
          </div>

        </div>
      </main>

      <AddInquiryDialog 
        open={showAddInquiry} 
        onOpenChange={setShowAddInquiry} 
        staff={staff}
      />

      <AddMemberDialog
        open={showConvertDialog}
        onOpenChange={setShowConvertDialog}
        staff={staff}
        initialData={selectedInquiry ? {
          fullName: selectedInquiry.fullName,
          phone: selectedInquiry.phone,
          email: selectedInquiry.email || "",
          gender: selectedInquiry.gender,
          dob: selectedInquiry.dob || "",
          address: selectedInquiry.address || "",
          membershipType: (selectedInquiry.membershipType as any) || "monthly",
          trainingType: selectedInquiry.trainingType || "general",
          notes: selectedInquiry.notes || "",
          feesPaid: selectedInquiry.feesPaid?.toString() || "",
          paymentOption: (selectedInquiry.paymentOption as any) || "cash",
          nickname: selectedInquiry.nickname || "",
          fitnessGoals: selectedInquiry.fitnessGoals || "",
          healthAssessment: selectedInquiry.healthAssessment || ""
        } : undefined}
        onSuccess={handleConvertSuccess}
      />
    </div>
  );
}
