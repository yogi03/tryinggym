"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/Sidebar";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { collection, getDocs, query, orderBy, updateDoc, doc } from "firebase/firestore";
import { Payment, Member } from "@/types";
import { Loader2, Search, FileText, Download, Mail, Eye, ArrowLeft, Filter, ChevronDown, IndianRupee, X, Receipt } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { downloadInvoicePdf, getInvoicePdfBase64 } from "@/lib/invoice";
import { useToast } from "@/hooks/use-toast";


interface EnrichedPayment extends Payment {
  memberDetails?: Member;
  allPaymentIds?: string[];
}

export default function InvoicesPage() {
  const { adminData, activeGym, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  
  const [invoices, setInvoices] = useState<EnrichedPayment[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<EnrichedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [emailingId, setEmailingId] = useState<string | null>(null);
  const [togglingGstId, setTogglingGstId] = useState<string | null>(null);

  // Filter State
  const [dateFilter, setDateFilter] = useState("Date");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");

  useEffect(() => {
    async function fetchData() {
      if (!adminData) return;
      try {
        const membersSnap = await getDocs(collection(db, "gyms", adminData.gymId, "members"));
        const membersDict: Record<string, Member> = {};
        membersSnap.forEach(d => {
          membersDict[d.id] = { memberId: d.id, ...d.data() } as Member;
        });

        // Fetch archived members as well
        const archivesSnap = await getDocs(collection(db, "archives", adminData.gymId, "members"));
        archivesSnap.forEach(d => {
          const data = d.data();
          if (data.archiveType === "member" && !membersDict[d.id]) {
             membersDict[d.id] = { memberId: d.id, ...data } as Member;
          }
        });

        const paymentsSnap = await getDocs(query(collection(db, "gyms", adminData.gymId, "payments"), orderBy("date", "desc")));
        const groupedMap: Record<string, EnrichedPayment> = {};

        paymentsSnap.docs.forEach(d => {
          const p = { id: d.id, ...d.data() } as Payment;
          const memberDetails = membersDict[p.memberId];
          
          if (memberDetails && !p.planType) {
            p.planType = memberDetails.membershipType;
            p.startDate = memberDetails.membershipStartDate;
            p.endDate = memberDetails.membershipEndDate;
          }
          const invKey = p.invoiceId || p.id!;
          if (!groupedMap[invKey]) {
            groupedMap[invKey] = { ...p, id: invKey, memberDetails, allPaymentIds: [p.id!] };
          } else {
            groupedMap[invKey].amount = (Number(groupedMap[invKey].amount) || 0) + (Number(p.amount) || 0);
            groupedMap[invKey].allPaymentIds = [...(groupedMap[invKey].allPaymentIds || []), p.id!];
          }
        });

        const paymentsData = Object.values(groupedMap).filter(p => p.amount > 0);
        
        setInvoices(paymentsData);
        setFilteredInvoices(paymentsData);
      } catch (error) {
        console.error("Error fetching invoices:", error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) {
      fetchData();
    }
  }, [adminData, authLoading]);

  const dateRange = useMemo(() => {
    if (dateFilter === "Date" || dateFilter === "all") return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    if (dateFilter === "today") return { start: today, end: endOfDay };
    if (dateFilter === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayEnd = new Date(yesterday);
      yesterdayEnd.setHours(23, 59, 59, 999);
      return { start: yesterday, end: yesterdayEnd };
    }
    if (dateFilter === "last7") {
      const start = new Date(today);
      start.setDate(start.getDate() - 7);
      return { start, end: endOfDay };
    }
    if (dateFilter === "last30") {
      const start = new Date(today);
      start.setDate(start.getDate() - 30);
      return { start, end: endOfDay };
    }
    if (dateFilter === "last90") {
      const start = new Date(today);
      start.setDate(start.getDate() - 90);
      return { start, end: endOfDay };
    }
    if (dateFilter === "half_yearly") {
      const start = new Date(today);
      start.setDate(start.getDate() - 180);
      return { start, end: endOfDay };
    }
    if (dateFilter === "yearly") {
      const start = new Date(today);
      start.setDate(start.getDate() - 365);
      return { start, end: endOfDay };
    }
    if (dateFilter === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }
    
    return null;
  }, [dateFilter, customStartDate, customEndDate]);

  useEffect(() => {
    let result = invoices;
    
    // Apply search query
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(inv => {
        const idMatch = inv.invoiceId?.toLowerCase().includes(q) || inv.id?.toLowerCase().includes(q);
        const nameMatch = inv.memberDetails?.fullName?.toLowerCase().includes(q);
        const refMatch = inv.memberId.toLowerCase().includes(q);
        return idMatch || nameMatch || refMatch;
      });
    }

    // Apply date filter
    if (dateRange) {
      result = result.filter(inv => {
        const invDate = new Date(inv.date);
        return invDate >= dateRange.start && invDate <= dateRange.end;
      });
    }

    setFilteredInvoices(result);
  }, [searchQuery, invoices, dateRange]);

  const totalCollection = useMemo(() => {
    return filteredInvoices.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
  }, [filteredInvoices]);

  const handleDownload = async (inv: EnrichedPayment) => {
    if (!inv.memberDetails) {
      toast({ title: "Error", description: "Member details missing", variant: "destructive" });
      return;
    }
    await downloadInvoicePdf({ payment: inv, member: inv.memberDetails, gym: activeGym || undefined });
    toast({ title: "Downloaded", description: "Invoice PDF has been downloaded successfully." });
  };

  const handleEmail = async (inv: EnrichedPayment) => {
    if (!inv.memberDetails?.email) {
      toast({ title: "No Email", description: "This member does not have an email address on file.", variant: "destructive" });
      return;
    }
    
    setEmailingId(inv.id || null);
    try {
      const pdfBase64 = await getInvoicePdfBase64({ payment: inv, member: inv.memberDetails, gym: activeGym || undefined });
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: adminData.gymId,
          email: inv.memberDetails.email,
          memberName: inv.memberDetails.fullName,
          invoiceId: inv.invoiceId || inv.id,
          pdfBase64,
          phone: inv.memberDetails.phone,
          amount: inv.amount,
          planType: inv.planType,
          withGst: inv.withGst
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to send email");

      toast({ title: "Email Sent", description: `Invoice sent to ${inv.memberDetails.email}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setEmailingId(null);
    }
  };

  const handleToggleGst = async (inv: EnrichedPayment) => {
    if (!inv.id || !adminData) return;

    if ((inv.gstToggleCount || 0) >= 2) {
      toast({ 
        title: "Limit Reached", 
        description: "GST status can only be toggled twice per invoice.", 
        variant: "destructive" 
      });
      return;
    }
    
    // Prevent converting to GST if gym has no validated GST number
    const isConvertingToGst = inv.withGst !== true;
    if (isConvertingToGst && activeGym?.gstStatus !== 'validated') {
      const msg = activeGym?.gstStatus === 'pending' 
        ? "GST Verification is still pending. Please wait for developer approval."
        : "Please provide and verify your GST Number in Settings before creating GST invoices.";
      toast({ 
        title: "GST Validation Required", 
        description: msg, 
        variant: "destructive" 
      });
      return;
    }

    setTogglingGstId(inv.id);
    try {
      const newGstValue = !inv.withGst; 
      const newCount = (inv.gstToggleCount || 0) + 1;
      
      const docIdsToUpdate = inv.allPaymentIds && inv.allPaymentIds.length > 0 
        ? inv.allPaymentIds 
        : [inv.id!];

      const updatePromises = docIdsToUpdate.map(docId => 
        updateDoc(doc(db, "gyms", adminData.gymId, "payments", docId), { 
          withGst: newGstValue,
          gstToggleCount: newCount
        })
      );
      
      await Promise.all(updatePromises);
      setInvoices(prev => prev.map(p => p.id === inv.id ? { ...p, withGst: newGstValue, gstToggleCount: newCount } : p));
      toast({ 
        title: "Invoice Updated", 
        description: `Invoice converted to ${newGstValue ? "GST Invoice" : "Normal Invoice"} successfully.` 
      });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update invoice type.", variant: "destructive" });
    } finally {
      setTogglingGstId(null);
    }
  };

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
      <main className="flex-1 p-4 sm:p-8 lg:p-10 space-y-8 min-h-screen max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          {/* <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => router.back()}
            className="hover:bg-[#1C1C1E] text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button> */}
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Invoices</h1>
            <p className="text-[#8888A0] mt-1">Manage and send GST invoices to members.</p>
          </div>
        </div>

        <div className="bg-[#1A1A2E]/80 backdrop-blur-sm border border-white/[0.08] rounded-2xl shadow-xl overflow-hidden flex flex-col">
          {/* Header Controls */}
          <div className="p-4 sm:p-6 border-b border-white/[0.08] flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="relative flex-1 w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#8888A0]" />
              <Input
                placeholder="Search by Name, Invoice ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 w-full bg-[#131313] border-white/[0.08] text-white focus:border-[#B6916D]/50 focus:ring-0 transition-all rounded-xl"
              />
            </div>

            <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="bg-[#131313] border-white/[0.08] text-white hover:bg-white/[0.04] h-10 rounded-xl" />}>
                  <Filter className="h-4 w-4 mr-2" /> Filters <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-80 p-4 bg-[#1A1A2E] border border-white/[0.08] text-white rounded-xl shadow-xl z-50 backdrop-blur-md" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Filter Invoices</h4>
                      {(dateFilter !== "Date" || searchQuery) && (
                        <button onClick={() => { setDateFilter("Date"); setSearchQuery(""); setCustomStartDate(""); setCustomEndDate(""); }} className="text-xs text-[#8888A0] hover:text-white">Reset</button>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs text-[#8888A0]">Invoice Date</label>
                      <Select value={dateFilter} onValueChange={(v) => {
                        setDateFilter(v || "Date");
                        if (v !== "custom") {
                          setCustomStartDate("");
                          setCustomEndDate("");
                        }
                      }}>
                        <SelectTrigger className="w-full h-9 bg-[#131313] border-white/[0.08] rounded-xl text-white">
                          <SelectValue>
                            {dateFilter === "Date" || dateFilter === "all" ? "All Time" :
                             dateFilter === "today" ? "Today" :
                             dateFilter === "yesterday" ? "Yesterday" :
                             dateFilter === "last7" ? "Last 7 Days" :
                             dateFilter === "last30" ? "Last Month" :
                             dateFilter === "last90" ? "Last Quarter" :
                             dateFilter === "half_yearly" ? "Half Yearly" :
                             dateFilter === "yearly" ? "Last Year" :
                             dateFilter === "custom" ? "Custom Range" : "Date"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="bg-[#1A1A2E] border-white/[0.08] text-white">
                          <SelectItem value="all">All Time</SelectItem>
                          <SelectItem value="today">Today</SelectItem>
                          <SelectItem value="yesterday">Yesterday</SelectItem>
                          <SelectItem value="last7">Last 7 Days</SelectItem>
                          <SelectItem value="last30">Last Month</SelectItem>
                          <SelectItem value="last90">Last Quarter</SelectItem>
                          <SelectItem value="half_yearly">Half Yearly</SelectItem>
                          <SelectItem value="yearly">Last Year</SelectItem>
                          <div 
                            className="p-2 mt-1 border-t border-white/[0.08] flex flex-col gap-2 rounded-b-md"
                            onClick={(e) => e.stopPropagation()}
                            onPointerDown={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#8888A0] w-8">From</span>
                              <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => {
                                  setCustomStartDate(e.target.value);
                                  if (e.target.value) setDateFilter("custom");
                                }}
                                className="bg-[#131313] border border-white/[0.08] rounded px-2 py-1 h-8 text-xs flex-1 outline-none focus:ring-1 focus:ring-[#B6916D] text-white cursor-pointer"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-[#8888A0] w-8">To</span>
                              <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => {
                                  setCustomEndDate(e.target.value);
                                  if (e.target.value) setDateFilter("custom");
                                }}
                                className="bg-[#131313] border border-white/[0.08] rounded px-2 py-1 h-8 text-xs flex-1 outline-none focus:ring-1 focus:ring-[#B6916D] text-white cursor-pointer"
                              />
                            </div>
                          </div>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="bg-[#131313]/50 px-4 sm:px-6 py-3 border-b border-white/[0.08] flex items-center flex-wrap gap-2 text-sm max-w-full overflow-hidden">
            <span className="text-[#8888A0] mr-2 font-medium">Active filters:</span>
            
            {dateFilter !== "Date" && dateFilter !== "all" && (
              <Badge variant="secondary" className="bg-[#B6916D]/10 text-[#B6916D] hover:bg-[#B6916D]/20 rounded-md py-1 px-2 border border-[#B6916D]/10 font-medium whitespace-nowrap">
                Date: {dateFilter}
                <button onClick={() => { setDateFilter("Date"); setCustomStartDate(""); setCustomEndDate(""); }} className="ml-1.5 focus:outline-none"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            <div className="ml-auto bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-md border border-emerald-500/20 flex items-center gap-1 font-semibold text-xs whitespace-nowrap mt-2 sm:mt-0">
              Total Collected: <IndianRupee className="h-3 w-3" />{totalCollection.toLocaleString()}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#131313]/80 text-[#8888A0] border-b border-white/[0.08]">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Invoice No</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Date</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Member Name</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Plan</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px]">Amount</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-wider text-[11px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-[#8888A0]">
                      <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>No invoices found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-6 py-4 font-mono text-[#E4E4E7]">
                        {inv.invoiceId || inv.id?.slice(0, 8)}
                      </td>
                      <td className="px-6 py-4 text-[#8888A0]">
                        {format(new Date(inv.date), "MMM dd, yyyy")}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          {inv.memberDetails?.photoUrl ? (
                            <img src={inv.memberDetails.photoUrl} alt="Photo" className="h-8 w-8 rounded-full object-cover bg-white/10" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-medium text-white">
                              {inv.memberDetails?.fullName?.charAt(0) || "?"}
                            </div>
                          )}
                          <div>
                            <div className="font-medium text-white">{inv.memberDetails?.fullName || "Unknown Member"}</div>
                            <div className="text-[11px] text-[#8888A0]">{inv.memberDetails?.phone || "No Phone"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="capitalize inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white/[0.04] text-[#E4E4E7] border border-white/[0.1]">
                          {inv.planType ? inv.planType.replace("-", " ") : (inv.memberDetails?.membershipType?.replace("-", " ") || "N/A")}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-emerald-400">
                        ₹{(inv.amount || 0).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                       <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Invoice"
                            className="h-8 w-8 text-[#8888A0] hover:text-[#B6916D] hover:bg-[#B6916D]/10"
                            onClick={() => router.push(`/admin/invoices/${inv.id}`)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Download PDF"
                            className="h-8 w-8 text-[#8888A0] hover:text-emerald-400 hover:bg-emerald-400/10"
                            onClick={() => handleDownload(inv)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={inv.memberDetails?.email ? "Email Invoice" : "No Email"}
                            disabled={!inv.memberDetails?.email || emailingId === inv.id}
                            className={`h-8 w-8 ${inv.memberDetails?.email ? 'text-[#8888A0] hover:text-blue-400 hover:bg-blue-400/10' : 'text-white/10'}`}
                            onClick={() => handleEmail(inv)}
                          >
                            {emailingId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={(inv.gstToggleCount || 0) >= 2 ? "Toggle limit reached (Max 2)" : (inv.withGst !== false ? "Convert to Normal Invoice" : "Convert to GST Invoice")}
                            disabled={togglingGstId === inv.id || (inv.gstToggleCount || 0) >= 2}
                            className={`h-8 w-8 ${togglingGstId === inv.id || (inv.gstToggleCount || 0) >= 2 ? 'opacity-20 cursor-not-allowed' : (inv.withGst !== false ? 'text-amber-400 hover:text-amber-300 hover:bg-amber-400/10' : 'text-purple-400 hover:text-purple-300 hover:bg-purple-400/10')}`}
                            onClick={() => handleToggleGst(inv)}
                          >
                            {togglingGstId === inv.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
