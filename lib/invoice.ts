import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { Member, Payment } from "@/types";

interface InvoiceData {
  payment: Payment;
  member: Member;
  gym?: {
    name: string;
    logoUrl?: string;
    contactEmail?: string;
    ownerEmail?: string;
    phone?: string;
    gstNo?: string;
  };
}

const DEFAULT_LOGO = "/gymmanagr-logo.png";

const getLogoBase64 = async (logoUrl?: string): Promise<string | null> => {
  try {
    const res = await fetch(logoUrl || DEFAULT_LOGO);
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to load logo", error);
    return null;
  }
};

async function buildInvoiceDoc({ payment, member, gym }: InvoiceData): Promise<jsPDF> {
  const doc = new jsPDF();
  
  const gymName = gym?.name || "GymManagr";
  const gymEmail = gym?.contactEmail || gym?.ownerEmail || "unfav.tushar@gmail.com";
  const gymPhone = gym?.phone || "+91 99994 03888"; 
  const gstNo = gym?.gstNo || ""; 

  // A tax invoice is only valid if both the payment flag is set AND the gym has a VALIDATED GST number.
  const isTaxInvoice = payment.withGst !== false && !!gstNo && (gym as any)?.gstStatus === 'validated';


  // Header
  // Logo
  const logoBase64 = await getLogoBase64(gym?.logoUrl);
  if (logoBase64) {
    // Center logo: (210 - 28) / 2 = 91
    doc.addImage(logoBase64, 'PNG', 91, 10, 28, 10);
  }

  // Gym Name
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(182, 145, 109); // #B6916D copper color
  doc.text(gymName.toUpperCase(), 105, 28, { align: "center" });
  
  // Contact Info & GST
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Email: ${gymEmail}  |  Phone: ${gymPhone}`, 105, 34, { align: "center" });
  if (isTaxInvoice) {
    doc.text(`GST No: ${gstNo}`, 105, 39, { align: "center" });
  }

  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.text(isTaxInvoice ? "TAX INVOICE" : "INVOICE", 105, 53, { align: "center" });
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 58, 196, 58);

  // Invoice Details & Billed To
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Invoice Details", 14, 68);
  doc.setFont("helvetica", "normal");
  const invId = payment.invoiceId || `INV-${new Date(payment.date).getTime().toString().slice(-8)}`;
  doc.text(`Invoice No: ${invId}`, 14, 75);
  doc.text(`Date: ${format(new Date(payment.date), "PPP")}`, 14, 82);
  
  doc.setFont("helvetica", "bold");
  doc.text("Billed To", 120, 68);
  doc.setFont("helvetica", "normal");
  doc.text(member.fullName, 120, 75);
  doc.text(`Phone: ${member.phone}`, 120, 82);
  if (member.email) doc.text(`Email: ${member.email}`, 120, 89);
  
  let description = "Membership Fee";
  if (payment.type === "joining_fee") description = "New Membership Registration";
  if (payment.type === "renewal_fee") description = "Membership Renewal";
  if (payment.type === "fee_correction") description = "Membership Fee (Corrected)";
  
  if (payment.planType) {
    const pType = payment.planType.replace("-", " ");
    description += ` - ${pType.charAt(0).toUpperCase() + pType.slice(1)} Plan`;
  }

  const trainingType = member.trainingType || (member.personalTrainerId ? "personal" : "general");
  description += trainingType === "personal" ? " (Personal Training)" : " (General Training)";

  const sgst = isTaxInvoice ? payment.amount * 0.025 : 0;
  const cgst = isTaxInvoice ? payment.amount * 0.025 : 0;
  const baseAmount = payment.amount - sgst - cgst;

  const tableData = [
    [
      description,
      payment.startDate ? format(new Date(payment.startDate), "MMM dd, yyyy") : "N/A",
      payment.endDate ? format(new Date(payment.endDate), "MMM dd, yyyy") : "N/A",
      `Rs. ${baseAmount.toFixed(2)}`
    ]
  ];

  autoTable(doc, {
    startY: 108,
    head: [['Description', 'Start Date', 'End Date', 'Amount']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [182, 145, 109], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 6 },
    columnStyles: {
      0: { cellWidth: 70 },
      1: { cellWidth: 35 },
      2: { cellWidth: 35 },
      3: { cellWidth: 40, halign: 'right' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 120;
  
  // Totals
  doc.setFont("helvetica", "normal");
  doc.text("Subtotal:", 135, finalY + 10);
  doc.text(`Rs. ${baseAmount.toFixed(2)}`, 196, finalY + 10, { align: "right" });
  
  if (isTaxInvoice) {
    doc.text("SGST (2.5%):", 135, finalY + 16);
    doc.text(`Rs. ${sgst.toFixed(2)}`, 196, finalY + 16, { align: "right" });
    
    doc.text("CGST (2.5%):", 135, finalY + 22);
    doc.text(`Rs. ${cgst.toFixed(2)}`, 196, finalY + 22, { align: "right" });
  }

  doc.setFont("helvetica", "bold");
  doc.text("Total Amount:", 135, finalY + 30);
  doc.text(`Rs. ${Number(payment.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 196, finalY + 30, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Thank you for being a part of ${gymName} Community!`, 105, finalY + 45, { align: "center" });

  return doc;
}

export async function downloadInvoicePdf(data: InvoiceData) {
  const doc = await buildInvoiceDoc(data);
  const invId = data.payment.invoiceId || `INV-${new Date(data.payment.date).getTime().toString().slice(-8)}`;
  doc.save(`${invId}_${data.member.fullName.replace(/\s+/g, '_')}.pdf`);
}

export async function getInvoicePdfBase64(data: InvoiceData): Promise<string> {
  const doc = await buildInvoiceDoc(data);
  return doc.output('datauristring').split(',')[1];
}

export async function getInvoicePdfDataUri(data: InvoiceData): Promise<string> {
  const doc = await buildInvoiceDoc(data);
  return doc.output('datauristring');
}

