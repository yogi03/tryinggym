"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { useAuth } from "@/lib/auth/auth-context";
import { Loader2, ArrowLeft, Download, Mail, FileCheck, Building2, User, Receipt } from "lucide-react";
import { query, collection, where, getDocs, getDoc, doc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { downloadInvoicePdf, getInvoicePdfBase64 } from "@/lib/invoice";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import AdminSidebar from "@/components/admin/Sidebar";
import { Member, Payment } from "@/types";

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { adminData, activeGym, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [payment, setPayment] = useState<Payment | null>(null);
  const [allPaymentIds, setAllPaymentIds] = useState<string[]>([]);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [emailing, setEmailing] = useState(false);
  const [togglingGst, setTogglingGst] = useState(false);
  const [pdfDataUri, setPdfDataUri] = useState<string | null>(null);

  useEffect(() => {
    async function fetchInvoice() {
      if (!id || !adminData) return;
      try {
        let payments: Payment[] = [];
        
        // 1. Try finding by document ID first to see if it belongs to an invoiceId
        const directDoc = await getDoc(doc(db, "gyms", adminData.gymId, "payments", id as string));
        
        if (directDoc.exists()) {
          const directData = { id: directDoc.id, ...directDoc.data() } as Payment;
          if (directData.invoiceId) {
            // Find all siblings
            const qSnap = await getDocs(query(collection(db, "gyms", adminData.gymId, "payments"), where("invoiceId", "==", directData.invoiceId)));
            payments = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
          } else {
            payments = [directData];
          }
        } else {
          // 2. Try finding by invoiceId directly (if navigated via Invoices page)
          const qSnap = await getDocs(query(collection(db, "gyms", adminData.gymId, "payments"), where("invoiceId", "==", id as string)));
          if (!qSnap.empty) {
            payments = qSnap.docs.map(d => ({ id: d.id, ...d.data() } as Payment));
          }
        }

        if (payments.length > 0) {
          setAllPaymentIds(payments.map(p => p.id!));
          
          // Aggregate into one virtual payment object for display
          const first = payments[0];
          const totalAmount = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
          const p: Payment = {
            ...first,
            amount: totalAmount,
            id: id as string // Maintain the identifier from the URL
          };

          const memberDoc = await getDoc(doc(db, "gyms", adminData.gymId, "members", p.memberId));
          let m: Member | null = null;
          
          if (memberDoc.exists()) {
            m = { memberId: memberDoc.id, ...memberDoc.data() } as Member;
          } else {
            const archiveDoc = await getDoc(doc(db, "archives", adminData.gymId, "members", p.memberId));
            if (archiveDoc.exists() && archiveDoc.data().archiveType === "member") {
              m = { memberId: archiveDoc.id, ...archiveDoc.data() } as Member;
            }
          }

          if (m) {
            setMember(m);
            if (!p.planType) {
              p.planType = m.membershipType;
              p.startDate = m.membershipStartDate;
              p.endDate = m.membershipEndDate;
            }
          }
          setPayment(p);
        }
      } catch (error) {
        console.error("Error fetching invoice:", error);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) {
      fetchInvoice();
    }
  }, [id, adminData, authLoading]);

  const handleDownload = async () => {
    if (!payment || !member) return;
    await downloadInvoicePdf({ payment, member, gym: activeGym || undefined });
    toast({ title: "Downloaded", description: "Invoice PDF has been downloaded successfully." });
  };

  const handleEmail = async () => {
    if (!payment || !member) return;
    if (!member.email) {
      toast({ title: "No Email", description: "This member does not have an email address on file.", variant: "destructive" });
      return;
    }

    setEmailing(true);
    try {
      const pdfBase64 = await getInvoicePdfBase64({ payment, member, gym: activeGym || undefined });
      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gymId: activeGym?.gymId,
          email: member.email,
          memberName: member.fullName,
          invoiceId: payment.invoiceId || payment.id,
          pdfBase64,
          phone: member.phone,
          amount: payment.amount,
          planType: payment.planType,
          withGst: payment.withGst
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Failed to send email");

      toast({ title: "Email Sent", description: `Invoice sent to ${member.email}` });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setEmailing(false);
    }
  };

  const handleToggleGst = async () => {
    if (!payment || !adminData) return;

    if ((payment.gstToggleCount || 0) >= 2) {
      toast({ 
        title: "Limit Reached", 
        description: "GST status can only be toggled twice per invoice.", 
        variant: "destructive" 
      });
      return;
    }

    // Prevent converting to GST if gym has no validated GST number
    const isConvertingToGst = payment.withGst !== true;
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

    setTogglingGst(true);
    try {
      const newGstValue = !payment.withGst;
      const newCount = (payment.gstToggleCount || 0) + 1;
      
      const updatePromises = allPaymentIds.map(docId => 
        updateDoc(doc(db, "gyms", adminData.gymId, "payments", docId), { 
          withGst: newGstValue,
          gstToggleCount: newCount
        })
      );
      
      await Promise.all(updatePromises);
      setPayment((prev: Payment | null) => prev ? { ...prev, withGst: newGstValue, gstToggleCount: newCount } : null);
      toast({
        title: "Invoice Updated",
        description: `Invoice converted to ${newGstValue ? "GST Invoice" : "Normal Invoice"} successfully.`
      });
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to update invoice type.", variant: "destructive" });
    } finally {
      setTogglingGst(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  if (!payment || !member) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#0F0F1A] text-white">
        <h2 className="text-2xl font-bold mb-4">Invoice Not Found</h2>
        <Button variant="outline" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-8 lg:p-10 space-y-6 max-w-4xl mx-auto flex flex-col min-h-screen">
        {/* Header Options */}
        {/* Header Options */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/[0.08] pb-6 shrink-0 gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="text-[#8888A0] hover:text-white hover:bg-white/[0.04]"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                <FileCheck className="h-5 w-5 sm:h-6 sm:w-6 text-[#B6916D]" />
                Invoice Details
              </h1>
              <p className="text-xs sm:text-sm text-[#8888A0]">{payment.invoiceId || id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
            <Button
              variant="outline"
              className={`flex-1 sm:flex-none bg-transparent border-white/[0.08] hover:border-current ${
                payment?.withGst !== false
                  ? 'text-amber-400 hover:bg-amber-400/10 hover:text-amber-300'
                  : 'text-purple-400 hover:bg-purple-400/10 hover:text-purple-300'
              } ${(payment.gstToggleCount || 0) >= 2 ? 'opacity-20 cursor-not-allowed' : ''}`}
              onClick={handleToggleGst}
              disabled={togglingGst || (payment.gstToggleCount || 0) >= 2}
              title={(payment.gstToggleCount || 0) >= 2 ? "Toggle limit reached (Max 2)" : (payment?.withGst !== false ? "Convert to Normal Invoice" : "Convert to GST Invoice")}
            >
              {togglingGst ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Receipt className="h-4 w-4 mr-2" />}
              {payment?.withGst !== false ? "Remove GST" : "Add GST"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 sm:flex-none bg-transparent border-white/[0.08] text-white hover:bg-blue-500/10 hover:text-blue-400 hover:border-blue-500/20"
              onClick={handleEmail}
              disabled={emailing || !member.email}
            >
              {emailing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              {member.email ? "Email PDF" : "No Email Found"}
            </Button>
            <Button
              className="flex-1 sm:flex-none bg-[#B6916D] hover:bg-[#B6916D]/90 text-white shadow-lg"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
          </div>
        </div>

        {/* HTML Invoice View */}
        <div className="flex-1 bg-white text-black p-4 sm:p-8 lg:p-12 shadow-2xl rounded-sm max-w-3xl mx-auto w-full mb-8 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#B6916D]/10 rounded-bl-full pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-gray-200 pb-8">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[#B6916D] uppercase tracking-tighter">{activeGym?.name || "GymManagr"}</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-sm text-gray-500 mt-2">
                {payment.withGst !== false && activeGym?.gstStatus === 'validated' && activeGym?.gstNo && (
                  <div className="flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    <span>GST No: <span className="font-semibold text-gray-700">{activeGym.gstNo}</span></span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-left sm:text-right">
              <h2 className="text-xl sm:text-2xl font-light text-gray-400 uppercase tracking-widest mb-2">
                {payment.withGst !== false ? "Tax Invoice" : "Invoice"}
              </h2>
              <div className="text-sm text-gray-600">
                <p>Invoice No: <span className="font-medium text-black">{payment.invoiceId || id}</span></p>
                <p>Date: <span className="font-medium text-black">{format(new Date(payment.date), "dd MMM yyyy")}</span></p>
              </div>
            </div>
          </div>

          <div className="py-8">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Billed To</h3>
            <div className="bg-gray-50 rounded-lg p-5 border border-gray-100 flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-gray-500" />
              </div>
              <div>
                <p className="font-bold text-lg text-gray-900">{member.fullName}</p>
                <div className="mt-1 space-y-1 text-sm text-gray-600">
                  <p>Phone: {member.phone}</p>
                  {member.email && <p>Email: {member.email}</p>}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto pb-4">
            {(() => {
              const trainingType = member.trainingType || (member.personalTrainerId ? "personal" : "general");
              const isTaxInvoice = payment.withGst !== false;
              const totalAmount = payment.amount || 0;
              const sgst = isTaxInvoice ? totalAmount * 0.025 : 0;
              const cgst = isTaxInvoice ? totalAmount * 0.025 : 0;
              const baseAmount = totalAmount - sgst - cgst;

              return (
                <>
                  <table className="w-full text-sm text-left border-collapse min-w-[500px]">
                    <thead>
                      <tr className="bg-[#B6916D] text-white">
                        <th className="px-5 py-3 rounded-tl-lg font-medium">Description</th>
                        <th className="px-5 py-3 font-medium">Period</th>
                        <th className={`px-5 py-3 font-medium text-right ${!isTaxInvoice ? 'rounded-tr-lg' : ''}`}>
                          {isTaxInvoice ? "Base Price" : "Amount"}
                        </th>
                        {isTaxInvoice && (
                          <>
                            <th className="px-5 py-3 font-medium text-right">SGST (2.5%)</th>
                            <th className="px-5 py-3 rounded-tr-lg font-medium text-right">CGST (2.5%)</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      <tr>
                        <td className="px-5 py-6">
                          <p className="font-semibold text-gray-900 mb-1">
                            {payment.type === "joining_fee" ? "New Membership Registration" : 
                             payment.type === "renewal_fee" ? "Membership Renewal" : 
                             payment.type === "installment_fee" ? "Membership Fee Installment" : "Membership Fee Correction"}
                          </p>
                          {payment.planType && (
                            <p className="text-gray-500 capitalize">{payment.planType.replace("-", " ")} Plan</p>
                          )}
                          <span className={`inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            trainingType === "personal" 
                              ? "bg-purple-100 text-purple-700 border border-purple-200" 
                              : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}>
                            {trainingType === "personal" ? "Personal Training" : "General Training"}
                          </span>
                        </td>
                        <td className="px-5 py-6 text-gray-600 font-medium">
                          {payment.startDate && payment.endDate ? (
                            <div className="space-y-1">
                              <p>{format(new Date(payment.startDate), "MMM dd, yyyy")}</p>
                              <p className="text-gray-400 text-xs text-center border-b border-gray-200 w-16 my-1">to</p>
                              <p>{format(new Date(payment.endDate), "MMM dd, yyyy")}</p>
                            </div>
                          ) : (
                            "N/A"
                          )}
                        </td>
                        <td className="px-5 py-6 text-right font-bold text-gray-900">
                          ₹{baseAmount.toFixed(2)}
                        </td>
                        {isTaxInvoice && (
                          <>
                            <td className="px-5 py-6 text-right font-medium text-gray-600">
                              ₹{sgst.toFixed(2)}
                            </td>
                            <td className="px-5 py-6 text-right font-medium text-gray-600">
                              ₹{cgst.toFixed(2)}
                            </td>
                          </>
                        )}
                      </tr>
                    </tbody>
                    <tfoot>
                      {isTaxInvoice && (
                        <>
                          <tr className="border-t border-gray-100">
                            <td colSpan={2}></td>
                            <td className="px-5 py-2 text-right text-sm text-gray-500">Subtotal</td>
                            <td colSpan={2} className="px-5 py-2 text-right font-medium text-gray-700">
                              ₹{baseAmount.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2}></td>
                            <td className="px-5 py-1 text-right text-sm text-gray-500">SGST (2.5%)</td>
                            <td colSpan={2} className="px-5 py-1 text-right font-medium text-gray-700">
                              ₹{sgst.toFixed(2)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={2}></td>
                            <td className="px-5 py-1 text-right text-sm text-gray-500">CGST (2.5%)</td>
                            <td colSpan={2} className="px-5 py-1 text-right font-medium text-gray-700">
                              ₹{cgst.toFixed(2)}
                            </td>
                          </tr>
                        </>
                      )}
                      <tr className="border-t-2 border-gray-200">
                        <td colSpan={2}></td>
                        <td className="px-5 py-4 text-right font-bold text-gray-600">Total Amount</td>
                        <td colSpan={isTaxInvoice ? 2 : 1} className="px-5 py-4 text-right font-black text-2xl text-[#B6916D]">
                          ₹{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </>
              );
            })()}
          </div>
          
          <div className="mt-16 text-center text-sm text-gray-400 border-t border-gray-100 pt-8">
            Thank you for being a part of {activeGym?.name || "GymManagr"}!
          </div>
        </div>
      </main>
    </div>
  );
}
