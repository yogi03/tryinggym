"use client";

import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { 
  UserPlus, 
  Calendar as CalendarIcon, 
  Loader2, 
  ChevronDown, 
  ChevronUp,
  Camera,
  X
} from "lucide-react";
import { db } from "@/lib/firebase/config";
import { collection, addDoc } from "firebase/firestore";
import { Inquiry, Staff } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";
import { toast } from "@/hooks/use-toast";
import { compressAndUploadPhoto } from "@/lib/cloudinary";

interface AddInquiryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: Staff[];
}

const DEFAULT_INQUIRY_FORM = {
  fullName: "",
  phone: "",
  notes: "",
  email: "",
  nickname: "",
  address: "",
  dob: "",
  gender: "male" as "male" | "female" | "other" | "prefer-not-to-say",
  membershipType: "",
  trainingType: "general" as "general" | "personal",
  personalTrainerId: "",
  membershipStartDate: "",
  membershipEndDate: "",
  feesPaid: "",
  paymentOption: "",
  takingMedication: "no",
  healthAssessment: "",
  fitnessGoals: "",
  reminderDate: ""
};

export default function AddInquiryDialog({ open, onOpenChange, staff }: AddInquiryDialogProps) {
  const { adminData, frontDeskData } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inquiryForm, setInquiryForm] = useState({ ...DEFAULT_INQUIRY_FORM });
  const [showOptional, setShowOptional] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const gymId = adminData?.gymId || frontDeskData?.gymId;

  const handleInputChange = (field: keyof typeof DEFAULT_INQUIRY_FORM, value: string) => {
    setInquiryForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "File too large", description: "Please select an image under 5MB.", variant: "destructive" });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    if (!gymId) return;
    if (!inquiryForm.fullName || !inquiryForm.phone || !inquiryForm.notes) {
      toast({ title: "Missing Fields", description: "Name, Phone, and Short Notes are required.", variant: "destructive" });
      return;
    }

    if (inquiryForm.trainingType === "personal" && !inquiryForm.personalTrainerId) {
      toast({ title: "Select Trainer", description: "Please select a trainer for Personal Training.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      let photoUrl = "";
      if (photoFile) {
        photoUrl = await compressAndUploadPhoto(photoFile, gymId, `inq-${Date.now()}`);
      }

      const now = new Date().toISOString();
      const inquiryData = {
        ...inquiryForm,
        gymId,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        photoUrl,
        notesHistory: [{ date: now, note: inquiryForm.notes }]
      };

      await addDoc(collection(db, "gyms", gymId, "inquiries"), inquiryData);
      
      toast({ title: "Success", description: "Inquiry added successfully." });
      setInquiryForm({ ...DEFAULT_INQUIRY_FORM });
      setPhotoFile(null);
      setPhotoPreview(null);
      onOpenChange(false);
    } catch (err) {
      console.error("Add inquiry error:", err);
      toast({ title: "Error", description: "Failed to add inquiry.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !isSubmitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#B6916D]" />
            New Inquiry
          </DialogTitle>
          <DialogDescription className="text-[#8888A0]">
            Record details of a potential new member.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Required Fields */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[#8888A0]">Full Name <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="e.g. John Doe" 
                  value={inquiryForm.fullName} 
                  onChange={(e) => handleInputChange("fullName", e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white" 
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[#8888A0]">Phone Number <span className="text-destructive">*</span></Label>
                <Input 
                  placeholder="e.g. 9876543210" 
                  value={inquiryForm.phone} 
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  className="bg-white/[0.04] border-white/[0.08] text-white" 
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Short Notes (Talk Summary) <span className="text-destructive">*</span></Label>
              <Textarea 
                placeholder="What was the result of the talk? Interested in what?" 
                value={inquiryForm.notes}
                onChange={(e) => handleInputChange("notes", e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white min-h-[80px]" 
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Follow-up Reminder Date</Label>
              <Input 
                type="date" 
                value={inquiryForm.reminderDate}
                onChange={(e) => handleInputChange("reminderDate", e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white" 
              />
            </div>
          </div>

          {/* Optional Toggle */}
          <div className="pt-2">
            <Button 
              variant="ghost" 
              className="w-full justify-between text-[#B6916D] hover:bg-[#B6916D]/10 px-2"
              onClick={() => setShowOptional(!showOptional)}
            >
              <span className="flex items-center gap-2">
                {showOptional ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                Additional Details (Optional)
              </span>
            </Button>
          </div>

          {showOptional && (
            <div className="space-y-6 border-t border-white/[0.04] pt-4 animate-in fade-in slide-in-from-top-2">
              {/* Photo Upload */}
              <div className="flex flex-col items-center justify-center gap-4 p-4 border border-dashed border-white/[0.1] rounded-lg bg-white/[0.02]">
                {photoPreview ? (
                  <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#B6916D]">
                    <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    <button onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="absolute top-0 right-0 bg-black/50 text-white p-1 rounded-full"><X className="h-3 w-3" /></button>
                  </div>
                ) : (
                  <Label htmlFor="inquiry-photo" className="flex flex-col items-center gap-2 cursor-pointer group">
                    <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center border-2 border-white/[0.1] group-hover:border-[#B6916D]/50 transition-colors">
                      <Camera className="h-8 w-8 text-[#8888A0] group-hover:text-[#B6916D]" />
                    </div>
                    <span className="text-xs font-medium text-[#8888A0]">Inquiry Member Photo</span>
                    <input id="inquiry-photo" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
                  </Label>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Nickname</Label><Input placeholder="Optional" value={inquiryForm.nickname} onChange={(e) => handleInputChange("nickname", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Email</Label><Input type="email" placeholder="e.g. john@email.com" value={inquiryForm.email} onChange={(e) => handleInputChange("email", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Gender</Label>
                  <Select value={inquiryForm.gender} onValueChange={(v) => handleInputChange("gender", v as any)}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Date of Birth</Label><Input type="date" value={inquiryForm.dob} onChange={(e) => handleInputChange("dob", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-[#8888A0]">Address</Label><Input placeholder="Address..." value={inquiryForm.address} onChange={(e) => handleInputChange("address", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
                
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Membership Type</Label>
                  <Select value={inquiryForm.membershipType} onValueChange={(v) => handleInputChange("membershipType", v || "")}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue placeholder="Choose plan" /></SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="half-yearly">Half-Yearly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Training Type</Label>
                  <Select value={inquiryForm.trainingType} onValueChange={(v) => handleInputChange("trainingType", v as any)}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue /></SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="personal">Personal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {inquiryForm.trainingType === "personal" && (
                  <div className="space-y-1.5">
                    <Label className="text-[#8888A0]">Select Trainer <span className="text-destructive">*</span></Label>
                    <Select value={inquiryForm.personalTrainerId} onValueChange={(v) => handleInputChange("personalTrainerId", v || "")}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue placeholder="Choose Trainer..." /></SelectTrigger>
                      <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                        {staff.filter(s => s.role === "Trainer").map(trainer => (
                          <SelectItem key={trainer.staffId} value={trainer.staffId}>{trainer.fullName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Fees Paid (Advance)</Label><Input type="number" placeholder="0" value={inquiryForm.feesPaid} onChange={(e) => handleInputChange("feesPaid", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
                <div className="space-y-1.5"><Label className="text-[#8888A0]">Payment Mode</Label>
                  <Select value={inquiryForm.paymentOption} onValueChange={(v) => handleInputChange("paymentOption", v || "")}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white"><SelectValue placeholder="Mode" /></SelectTrigger>
                    <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-[#8888A0]">Health Assessment</Label><Input placeholder="Health notes..." value={inquiryForm.healthAssessment} onChange={(e) => handleInputChange("healthAssessment", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label className="text-[#8888A0]">Fitness Goals</Label><Input placeholder="Goal..." value={inquiryForm.fitnessGoals} onChange={(e) => handleInputChange("fitnessGoals", e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white" /></div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="pt-4 border-t border-white/[0.08]">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting} className="bg-transparent border-white/[0.08] text-[#8888A0] hover:bg-white/[0.04]">Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2 bg-[#B6916D] hover:bg-[#B6916D]/90 text-white">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Save Inquiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
