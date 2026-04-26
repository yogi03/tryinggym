"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, collection, getDocs, updateDoc, query, where, limit } from "firebase/firestore";
import { Gym, Member } from "@/types";
import AdminSidebar from "@/components/admin/Sidebar";
import { deleteGymWithArchive, updateGymSettings, updateGymLogo, verifyGSTStatus } from "./actions";
import { uploadGSTDocument } from "@/lib/cloudinary";
import { notifyDeveloperOfGST } from "./notify-developer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Users,
  Download,
  Trash2,
  AlertTriangle,
  Upload,
  Link as LinkIcon,
  Building,
  Mail,
  Camera,
  Check,
  Globe,
  Phone,
  Receipt,
  FileText,
  BadgeCheck,
  Clock,
  XCircle,
  ExternalLink,
  IndianRupee,
  Archive,
  RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import * as XLSX from "xlsx";
import { compressAndUploadPhoto, uploadGymLogoToCloudinary } from "@/lib/cloudinary";

export default function SettingsPage() {
  const { adminData, user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  
  const [gymName, setGymName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [gymPhone, setGymPhone] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isVerifyingGst, setIsVerifyingGst] = useState(false);
  const [paymentRecipients, setPaymentRecipients] = useState<string[]>([]);
  const [archivedPaymentRecipients, setArchivedPaymentRecipients] = useState<string[]>([]);
  const [newRecipientName, setNewRecipientName] = useState("");

  const isDeveloper = adminData?.role === "developer";

  const updateRecipientsDb = async (active: string[], archived: string[]) => {
    if (!adminData?.gymId) return { success: false, error: "No Gym ID" };
    try {
      const result = await updateGymSettings(adminData.gymId, {
        paymentRecipients: active,
        archivedPaymentRecipients: archived
      });
      if (!result.success) throw new Error(result.error);

      setGym(prev => prev ? { ...prev, paymentRecipients: active, archivedPaymentRecipients: archived } : null);
      return { success: true };
    } catch(err) {
      toast({ title: "Error", description: "Failed to save recipients.", variant: "destructive", toast: undefined });
      return { success: false, error: err };
    }
  };

  useEffect(() => {
    async function fetchGym() {
      if (!adminData?.gymId) return;
      try {
        const gymDoc = await getDoc(doc(db, "gyms", adminData.gymId));
        if (gymDoc.exists()) {
          const gymData = { gymId: adminData.gymId, ...gymDoc.data() } as Gym;
          setGym(gymData);
        }
      } catch (err) {
        console.error("Error fetching gym:", err);
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading) fetchGym();
  }, [adminData, authLoading]);

  useEffect(() => {
    if (gym) {
      setGymName(gym.name);
      setContactEmail(gym.contactEmail || "");
      setGymPhone(gym.phone || "");
      setGstNo(gym.gstNo || "");
      setPaymentRecipients(gym.paymentRecipients || []);
      setArchivedPaymentRecipients(gym.archivedPaymentRecipients || []);
    }
  }, [gym]);

  const handleDownloadTemplate = () => {
    window.open("https://docs.google.com/spreadsheets/d/1-nnCwi0zfbQHNbp7Dmwn2vuBfY_VC-VuoHuqt3p-F6w/edit?usp=sharing", "_blank");
    toast({ title: "Opening Template", description: "The master Google Sheet template is opening in a new tab." });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const processImportedData = async (data: any[]) => {
    if (!adminData?.gymId) return;
    setIsImporting(true);

    // Parse Excel serial number OR a date string to ISO yyyy-MM-dd
    const parseExcelDate = (val: string): string => {
      if (!val) return new Date().toISOString().split("T")[0];
      const num = Number(val);
      if (!isNaN(num) && num > 1000) {
        const utc = new Date(Date.UTC(1899, 11, 30 + num));
        return utc.toISOString().split("T")[0];
      }
      const d = new Date(val);
      if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
      return new Date().toISOString().split("T")[0];
    };

    const addMonths = (dateStr: string, months: number): string => {
      const d = new Date(dateStr);
      d.setMonth(d.getMonth() + months);
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    };

    const calcEndDate = (startDate: string, membershipType: string, customMonthsStr?: string): string => {
      const typeMap: Record<string, number> = {
        trial: 0,
        monthly: 1,
        quarterly: 3,
        "half-yearly": 6,
        yearly: 12,
      };
      const months = typeMap[membershipType];
      if (months !== undefined) return addMonths(startDate, months || 1);
      const customMonths = parseInt(customMonthsStr || "1", 10);
      return addMonths(startDate, isNaN(customMonths) ? 1 : customMonths);
    };

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const membersToImport = data.map((row: any) => {
        const getVal = (keys: string[]) => {
          const rowKey = Object.keys(row).find(k => keys.includes(k.toLowerCase().trim()));
          return rowKey ? String(row[rowKey]).trim() : "";
        };

        const mType = (getVal(["membership type", "type", "plan", "membership"]) || "monthly").toLowerCase();
        const pOption = (getVal(["payment option", "payment mode", "payment", "mode of payment"]) || "other").toLowerCase();

        return {
          memberId: getVal(["member id", "memberid", "id"]),
          fullName: getVal(["full name", "name", "member name", "fullname", "member"]),
          nickname: getVal(["nickname", "nick name"]),
          email: getVal(["email", "email address", "mail", "gmail"]),
          phone: getVal(["phone", "mobile", "contact", "phone number", "whatsapp", "mobile number"]),
          gender: (getVal(["gender", "sex"]) || "prefer-not-to-say").toLowerCase(),
          dob: parseExcelDate(getVal(["date of birth", "dob", "birth date", "birthdate"])),
          address: getVal(["address", "residential address", "location", "city"]),
          membershipType: mType,
          get membershipStartDate() { return parseExcelDate(getVal(["start date", "membership start date", "joined", "joining date", "date of joining", "timestamp", "date"])); },
          get membershipEndDate() {
            const rawEnd = getVal(["end date", "membership end date", "expiry", "expiry date", "valid upto"]);
            if (rawEnd) return parseExcelDate(rawEnd);
            return calcEndDate(this.membershipStartDate, this.membershipType, getVal(["months", "duration", "custom months"]));
          },
          paymentOption: pOption,
          healthAssessment: getVal(["health assessment", "health", "medical", "medical conditions"]) || "None",
          isTakingMedication: (getVal(["taking medication", "medication", "medicines", "meds"]) || "no").toLowerCase().includes("yes") ? "yes" : "no",
          fitnessGoals: getVal(["fitness goals", "goals", "goal", "purpose"]),
          feesPaid: Number(getVal(["fees paid", "fees", "amount paid", "amount"]) || 0),
          customMonths: getVal(["custom months", "months"]),
          trainingType: (getVal(["training type", "training"]) || "general").toLowerCase(),
          selfDeclaration: true,
        };
      }).filter(m => m.fullName && m.phone);

      if (membersToImport.length === 0) {
        toast({ title: "No New Members", description: "No valid or unique members found to import. Check headers and phone numbers.", variant: "destructive", toast: undefined });
        return;
      }

      const { importMembersBulk } = await import("./actions");
      const result = await importMembersBulk(adminData.gymId, membersToImport);
      
      if (result.success) {
        toast({ title: "Import Complete", description: `Successfully imported ${result.count} unique members.${result.message ? " " + result.message : ""}`, toast: undefined });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
       console.error("Import error:", error);
       toast({ title: "Error", description: (error as Error).message || "Failed to import members.", variant: "destructive", toast: undefined });
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        processImportedData(data);
      } catch {
        toast({ title: "Error", description: "Failed to parse file.", variant: "destructive", toast: undefined });
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleGoogleSheetImport = async () => {
    if (!googleSheetUrl) return;
    setIsImporting(true);
    try {
      const { fetchGoogleSheetCsv } = await import("./actions");
      const result = await fetchGoogleSheetCsv(googleSheetUrl);
      
      if (!result.success || !result.csv) {
        throw new Error(result.error);
      }
      
      const wb = XLSX.read(result.csv, { type: "string" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);
      
      processImportedData(data);
      setGoogleSheetUrl("");
    } catch (error) {
       console.error("Sheet import error:", error);
       toast({ title: "Error", description: (error as Error).message, variant: "destructive", toast: undefined });
       setIsImporting(false);
    }
  };

  const handleExportExcel = async () => {
    if (!adminData?.gymId) return;
    setIsExporting(true);
    try {
      const membersRef = collection(db, "gyms", adminData.gymId, "members");
      const snapshot = await getDocs(membersRef);
      const members = snapshot.docs.map((doc) => {
        const data = doc.data() as Member;
        return {
          "Member ID": doc.id,
          "Full Name": data.fullName,
          "Nickname": data.nickname || "",
          "Email": data.email,
          "Phone": data.phone,
          "Gender": data.gender,
          "Date of Birth": data.dob,
          "Address": data.address,
          "Membership Type": data.membershipType,
          "Start Date": data.membershipStartDate,
          "End Date": data.membershipEndDate,
          "Payment Option": data.paymentOption,
          "Health Assessment": data.healthAssessment,
          "Taking Medication": data.isTakingMedication,
          "Fitness Goals": data.fitnessGoals || "",
          "Registered On": data.createdAt,
        };
      });

      const ws = XLSX.utils.json_to_sheet(members);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Members");

      const maxWidths = Object.keys(members[0] || {}).map((key) => {
        const maxLen = Math.max(
          key.length,
          ...members.map((row) => String((row as Record<string, unknown>)[key] || "").length)
        );
        return { wch: Math.min(maxLen + 2, 40) };
      });
      ws["!cols"] = maxWidths;

      const gymName = gym?.name || "gym";
      const date = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, `${gymName.replace(/\s+/g, "_")}_members_${date}.xlsx`);

      toast({
        title: "Export Complete",
        description: `${members.length} members exported to Excel.`,
        toast: undefined
      });
    } catch (err) {
      console.error("Export error:", err);
      toast({
        title: "Error",
        description: "Failed to export members.",
        variant: "destructive",
        toast: undefined
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteGym = async () => {
    if (!adminData?.gymId || !user) return;
    setIsDeleting(true);
    try {
      const result = await deleteGymWithArchive(adminData.gymId, user.uid);
      if (result.success) {
        toast({
          title: "Gym Deleted",
          description: "Your gym and all data have been archived and removed.",
          toast: undefined
        });
        router.push("/admin/login");
      } else {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
          toast: undefined
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to delete gym.",
        variant: "destructive",
        toast: undefined
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6 pt-12 lg:pt-0">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground text-sm">
              Manage your gym settings, branding, and data.
            </p>
          </div>

          {/* Gym Branding */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Gym Branding
              </CardTitle>
              <CardDescription>
                Customize your gym&apos;s visual identity. Your logo will appear on the admin panel and registration pages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 border rounded-lg bg-muted/10">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-lg overflow-hidden border-2 border-primary/20 bg-background flex items-center justify-center">
                    {gym?.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img 
                        src={gym.logoUrl} 
                        alt="Gym Logo" 
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Building className="h-10 w-10 text-muted-foreground/30" />
                    )}
                  </div>
                  {isUploadingLogo && (
                    <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 space-y-2">
                  <p className="font-medium text-sm">Gym Logo</p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Recommendation: High resolution PNG or SVGs work best. Square or horizontal aspect ratio.
                  </p>
                  <div className="relative inline-block">
                    <Input
                      type="file"
                      accept="image/*"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !adminData?.gymId) return;

                        setIsUploadingLogo(true);
                        try {
                          const url = await uploadGymLogoToCloudinary(file, adminData.gymId);
                          if (url) {
                            const result = await updateGymLogo(adminData.gymId, url);
                            if (result.success) {
                              setGym(prev => prev ? { ...prev, logoUrl: url } : null);
                              toast({ title: "Logo Updated", description: "Gym logo has been updated successfully." });
                            } else {
                              throw new Error(result.error);
                            }
                          }
                        } catch (error) {
                          toast({ title: "Error", description: "Failed to upload logo.", variant: "destructive" });
                        } finally {
                          setIsUploadingLogo(false);
                        }
                      }}
                      disabled={isUploadingLogo}
                    />
                    <Button variant="outline" size="sm" disabled={isUploadingLogo}>
                      {isUploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Change Logo
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Gym Identity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Gym Identity
              </CardTitle>
              <CardDescription>
                Update your gym name and contact information.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gymName">Gym Name</Label>
                  <div className="relative">
                    <Building className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="gymName"
                      placeholder="Gym Name"
                      className="pl-9"
                      value={gymName}
                      onChange={(e) => setGymName(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Owner Account Email (Read-only)</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      disabled
                      value={gym?.ownerEmail || "N/A"}
                      className="pl-9 opacity-50 bg-muted/30"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Contact yogendrachaurasiya30@gmail.com to change official email
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gymPhone">Gym Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="gymPhone"
                      placeholder="+91 99999 88888"
                      className="pl-9"
                      value={gymPhone}
                      onChange={(e) => setGymPhone(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-4 pt-2 border-t border-white/[0.08]">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="gstNo">GST Number</Label>
                    {gym?.gstStatus && gym.gstStatus !== 'none' && (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                        {gym.gstStatus === 'validated' && (
                          <span className="flex items-center gap-1 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded">
                            <BadgeCheck className="h-3 w-3" /> Verified
                          </span>
                        )}
                        {gym.gstStatus === 'pending' && (
                          <span className="flex items-center gap-1 text-amber-400 bg-amber-400/10 px-2 py-1 rounded">
                            <Clock className="h-3 w-3" /> Pending Verification
                          </span>
                        )}
                        {gym.gstStatus === 'rejected' && (
                          <span className="flex items-center gap-1 text-rose-400 bg-rose-400/10 px-2 py-1 rounded">
                            <XCircle className="h-3 w-3" /> Rejected
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="relative">
                    <Receipt className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="gstNo"
                      placeholder="07AAACA1234A1Z1"
                      className="pl-9"
                      value={gstNo}
                      onChange={(e) => setGstNo(e.target.value)}
                    />
                  </div>

                  {gstNo && gym?.gstStatus !== 'validated' && (
                    <div className="space-y-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.06]">
                      <Label className="text-xs text-muted-foreground">
                        {gym?.gstStatus === 'rejected' ? 'Re-upload GST Supporting Document' : 'GST Supporting Document (PDF Required)'}
                      </Label>
                      <div className="flex items-center gap-3">
                        <Input
                          type="file"
                          accept=".pdf"
                          className="text-xs h-8 bg-black/20"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                        />
                        {gym?.gstDocumentUrl && (
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-blue-400"
                            onClick={() => window.open(gym.gstDocumentUrl, '_blank')}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {gym?.gstStatus === 'rejected' && (
                        <p className="text-[10px] text-rose-400 font-medium italic">Your previous document was rejected. Please upload a valid document for re-verification.</p>
                      )}
                      <p className="text-[10px] text-muted-foreground">Please upload your GST certificate for manual verification.</p>
                    </div>
                  )}

                  {isDeveloper && gym?.gstStatus === 'pending' && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-blue-400">Developer Verification</p>
                        <p className="text-[10px] text-blue-400/70">Verify the documents and GST number.</p>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="h-8 text-[10px] border-rose-500/50 text-rose-500 hover:bg-rose-500/10"
                          disabled={isVerifyingGst}
                          onClick={async () => {
                            if (!gym?.gymId) return;
                            setIsVerifyingGst(true);
                            const res = await verifyGSTStatus(gym.gymId, 'rejected');
                            if (res.success) {
                              setGym(prev => prev ? { ...prev, gstStatus: 'rejected' } : null);
                              toast({ title: "GST Rejected" });
                            }
                            setIsVerifyingGst(false);
                          }}
                        >
                          Reject
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-8 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={isVerifyingGst}
                          onClick={async () => {
                            if (!gym?.gymId) return;
                            setIsVerifyingGst(true);
                            const res = await verifyGSTStatus(gym.gymId, 'validated');
                            if (res.success) {
                              setGym(prev => prev ? { ...prev, gstStatus: 'validated' } : null);
                              toast({ title: "GST Verified" });
                            }
                            setIsVerifyingGst(false);
                          }}
                        >
                          Approve
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              <div className="pt-2">
                <Button 
                  onClick={async () => {
                    if (!adminData?.gymId) return;
                    setIsUpdatingSettings(true);
                    try {
                      let currentGstDocumentUrl = gym?.gstDocumentUrl || "";
                      let currentGstStatus = gym?.gstStatus || 'none';

                      if ((gstNo && gstNo !== gym?.gstNo) || selectedFile) {
                        if (!selectedFile && !gym?.gstDocumentUrl) {
                          toast({ title: "Document Required", description: "Please upload a supporting document for the GST number.", variant: "destructive" });
                          setIsUpdatingSettings(false);
                          return;
                        }

                        if (selectedFile) {
                          setIsUploadingDoc(true);
                          const reader = new FileReader();
                          const pdfBase64Promise = new Promise<string>((resolve) => {
                            reader.onload = () => {
                              const base64 = (reader.result as string).split(',')[1];
                              resolve(base64);
                            };
                            reader.readAsDataURL(selectedFile);
                          });

                          const [docUrl, pdfBase64] = await Promise.all([
                            uploadGSTDocument(selectedFile, adminData.gymId),
                            pdfBase64Promise
                          ]);

                          currentGstDocumentUrl = docUrl;
                          currentGstStatus = 'pending';
                          setIsUploadingDoc(false);
                          await notifyDeveloperOfGST(gymName, gstNo, docUrl, pdfBase64);
                        } else {
                          if (gstNo !== gym?.gstNo) {
                            currentGstStatus = 'pending';
                          }
                        }
                      } else if (!gstNo) {
                        currentGstStatus = 'none';
                      }

                      const result = await updateGymSettings(adminData.gymId, {
                        gstNo: gstNo,
                        gstStatus: currentGstStatus,
                        gstDocumentUrl: currentGstDocumentUrl,
                      });
                      if (result.success) {
                        toast({ title: "Settings Updated", description: "Gym identity has been updated successfully." });
                        setGym(prev => prev ? { ...prev, name: gymName, gstNo, gstStatus: currentGstStatus, gstDocumentUrl: currentGstDocumentUrl } : null);
                        setSelectedFile(null);
                        window.location.reload();
                      } else {
                        throw new Error(result.error);
                      }
                    } catch (error) {
                      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
                    } finally {
                      setIsUpdatingSettings(false);
                    }
                  }}
                  disabled={
                    isUpdatingSettings || 
                    (gymName === gym?.name && 
                     gymPhone === (gym?.phone || "") && 
                     gstNo === (gym?.gstNo || "") && 
                     !selectedFile)
                  }
                >
                  {isUpdatingSettings ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Payment Recipients
              </CardTitle>
              <CardDescription>
                Manage the list of admins or staff members who can receive payments. These names will appear as options during member registration.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="e.g. Rahul"
                  value={newRecipientName}
                  onChange={(e) => setNewRecipientName(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (newRecipientName.trim()) {
                        const newActive = [...paymentRecipients, newRecipientName.trim()];
                        const result = await updateRecipientsDb(newActive, archivedPaymentRecipients);
                        if (result.success) {
                          setPaymentRecipients(newActive);
                          setNewRecipientName("");
                          toast({ title: "Recipient Added", description: `${newRecipientName.trim()} has been added.`, toast: undefined });
                        }
                      }
                    }
                  }}
                />
                <Button 
                  onClick={async () => {
                    if (newRecipientName.trim()) {
                      const newActive = [...paymentRecipients, newRecipientName.trim()];
                      const result = await updateRecipientsDb(newActive, archivedPaymentRecipients);
                      if (result.success) {
                        setPaymentRecipients(newActive);
                        setNewRecipientName("");
                        toast({ title: "Recipient Added", description: `${newRecipientName.trim()} has been added.`, toast: undefined });
                      }
                    }
                  }}
                >
                  Add
                </Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {paymentRecipients.map((name, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 bg-[#B6916D]/10 text-[#B6916D] px-3 py-1.5 rounded-full border border-[#B6916D]/20 text-sm font-medium"
                  >
                    {name}
                    <button 
                      onClick={async () => {
                        if (!adminData?.gymId) return;

                        // Check if the recipient has any associated payments
                        const paymentsRef = collection(db, "gyms", adminData.gymId, "payments");
                        const q = query(paymentsRef, where("receivedBy", "==", name), limit(1));
                        const paymentsSnap = await getDocs(q);

                        const newActive = paymentRecipients.filter((_, i) => i !== index);

                        if (paymentsSnap.empty) {
                          // Hasn't received money, directly delete
                          const result = await updateRecipientsDb(newActive, archivedPaymentRecipients);
                          if (result.success) {
                            setPaymentRecipients(newActive);
                            toast({ title: "Recipient Deleted", description: `${name} has been permanently deleted as they had no payment history.`, toast: undefined });
                          }
                        } else {
                          // Has received money, move to archive
                          const newArchived = [...archivedPaymentRecipients, name];
                          const result = await updateRecipientsDb(newActive, newArchived);
                          if (result.success) {
                            setPaymentRecipients(newActive);
                            setArchivedPaymentRecipients(newArchived);
                            toast({ title: "Recipient Archived", description: `${name} has been archived to preserve payment history.`, toast: undefined });
                          }
                        }
                      }}
                      className="hover:text-red-500 transition-colors"
                      title="Remove Recipient"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {paymentRecipients.length === 0 && (
                  <p className="text-sm text-muted-foreground italic px-1">No recipients added yet.</p>
                )}
              </div>

              {archivedPaymentRecipients.length > 0 && (
                <div className="pt-4 mt-2 border-t border-white/[0.08]">
                  <Label className="text-xs text-muted-foreground mb-2 block">Archived Recipients</Label>
                  <div className="flex flex-wrap gap-2">
                    {archivedPaymentRecipients.map((name, index) => (
                      <div 
                        key={index}
                        className="flex items-center gap-2 bg-muted/20 text-muted-foreground px-3 py-1.5 rounded-full border border-muted/20 text-sm font-medium"
                      >
                        {name}
                        <button 
                          onClick={async () => {
                            const newArchived = archivedPaymentRecipients.filter((_, i) => i !== index);
                            const newActive = [...paymentRecipients, name];
                            const result = await updateRecipientsDb(newActive, newArchived);
                            if (result.success) {
                              setArchivedPaymentRecipients(newArchived);
                              setPaymentRecipients(newActive);
                              toast({ title: "Recipient Restored", description: `${name} has been restored.`, toast: undefined });
                            }
                          }}
                          className="hover:text-[#B6916D] transition-colors"
                          title="Restore Recipient"
                        >
                          <RefreshCw className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Import Members */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Import Members
                </CardTitle>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-8 text-[10px] font-bold border-primary/20 hover:bg-primary/5"
                  onClick={handleDownloadTemplate}
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Download Template
                </Button>
              </div>
              <CardDescription>
                Bulk import members using an Excel file (.xlsx) or a public Google Sheet URL. 
                <span className="block mt-1 text-primary/80 font-medium">Use the template for accurate results.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4 border p-4 rounded-lg bg-muted/20">
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-sm">Upload File</p>
                    <p className="text-xs text-muted-foreground">Select an .xlsx or .csv file</p>
                  </div>
                  <div className="relative">
                    <Input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={handleFileUpload}
                      disabled={isImporting}
                    />
                    <Button variant="outline" disabled={isImporting} className="pointer-events-none">
                      {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                      Choose File
                    </Button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-end gap-4 border p-4 rounded-lg bg-muted/20">
                  <div className="flex-1 space-y-3 w-full">
                    <div>
                      <p className="font-medium text-sm">Google Sheet URL</p>
                      <p className="text-xs text-muted-foreground">Ensure access is set to &apos;Anyone with the link&apos;</p>
                    </div>
                    <Input
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={googleSheetUrl}
                      onChange={(e) => setGoogleSheetUrl(e.target.value)}
                      disabled={isImporting}
                    />
                  </div>
                  <Button 
                    onClick={handleGoogleSheetImport} 
                    disabled={isImporting || !googleSheetUrl}
                    className="w-full sm:w-auto mt-2 sm:mt-0"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LinkIcon className="h-4 w-4 mr-2" />}
                    Fetch URL
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Export Members */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Export Members
              </CardTitle>
              <CardDescription>
                Download a complete Excel spreadsheet of all your gym members.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={handleExportExcel}
                disabled={isExporting}
                className="w-full sm:w-auto"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Download Excel (.xlsx)
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Gym Permanently
            </DialogTitle>
            <DialogDescription>
              This action cannot be undone. All gym data, members, and admin
              access will be removed. <br />
              <br />
              Type <strong>{gym?.name || "gym name"}</strong> to confirm:
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder={gym?.name || "Type gym name to confirm"}
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
          />
          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteGym}
              disabled={
                isDeleting || deleteConfirmText !== (gym?.name || "")
              }
              className="w-full sm:w-auto"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
