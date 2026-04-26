"use client";

import { useState } from "react";
import { UserPlus, Camera, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth/auth-context";
import { db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { compressAndUploadPhoto } from "@/lib/cloudinary";
import { Staff } from "@/types";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_STAFF_FORM = {
  fullName: "",
  email: "",
  phone: "",
  role: "Trainer",
  status: "Active",
  certifications: "",
  specialties: "",
  salary: "",
  weekSchedule: [] as { day: string; startTime: string; endTime: string }[],
  joiningDate: new Date().toISOString().split("T")[0],
  notes: "",
};

interface AddStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function AddStaffDialog({ open, onOpenChange, onSuccess }: AddStaffDialogProps) {
  const { adminData, frontDeskData } = useAuth();
  const { toast } = useToast();
  const gymId = adminData?.gymId || frontDeskData?.gymId;
  const [addForm, setAddForm] = useState({ ...DEFAULT_STAFF_FORM });
  const [isAdding, setIsAdding] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({ title: "File too large", description: "Image must be under 10MB.", variant: "destructive" });
        return;
      }
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const generateStaffId = (name: string, phone: string) => {
    const prefix = name.trim().slice(0, 2).toLowerCase().replace(/[^a-z]/g, "");
    return `${prefix}${phone.trim()}`;
  };

  const addScheduleDay = () => {
    setAddForm(prev => ({
      ...prev,
      weekSchedule: [...prev.weekSchedule, { day: "", startTime: "09:00", endTime: "17:00" }],
    }));
  };

  const removeScheduleDay = (idx: number) => {
    setAddForm(prev => ({
      ...prev,
      weekSchedule: prev.weekSchedule.filter((_, i) => i !== idx),
    }));
  };

  const updateScheduleDay = (idx: number, field: string, value: string) => {
    setAddForm(prev => ({
      ...prev,
      weekSchedule: prev.weekSchedule.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  const handleAddStaff = async () => {
    if (!gymId) return;
    const { fullName, phone, email, role, status, certifications, specialties, joiningDate } = addForm;

    if (!fullName || !email || !phone) {
      toast({ title: "Missing Fields", description: "Name, email, and phone are required.", variant: "destructive" });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Invalid Phone", description: "Phone number must be 10 digits and start with 6, 7, 8, or 9.", variant: "destructive" });
      return;
    }

    setIsAdding(true);
    const { dismiss } = toast({ title: "Adding Staff...", description: "Please wait.", duration: Infinity });
    
    try {
      const staffId = generateStaffId(fullName, phone);

      let photoUrl = "";
      if (photoFile) {
        photoUrl = await compressAndUploadPhoto(photoFile, gymId, staffId);
      }

      const now = new Date().toISOString();
      const parsedCerts = certifications.split(",").map(s => s.trim()).filter(Boolean);
      const parsedSpecs = specialties.split(",").map(s => s.trim()).filter(Boolean);
      const validSchedule = addForm.weekSchedule.filter(s => s.day && s.startTime && s.endTime);
      const availDays = validSchedule.map(s => s.day);

      // Create staff document - omitting undefined fields to avoid Firestore error
      const staffData: any = {
        gymId,
        fullName,
        email,
        phone,
        role: role as Staff["role"],
        status: status as Staff["status"],
        availability: { days: availDays, shifts: [] },
        createdAt: now,
        assignedMembersCount: 0,
        joiningDate: joiningDate || now.split("T")[0],
      };

      if (parsedCerts.length > 0) staffData.certifications = parsedCerts;
      if (parsedSpecs.length > 0) staffData.specialties = parsedSpecs;
      if (photoUrl) staffData.photoUrl = photoUrl;
      if (addForm.salary) staffData.salary = Number(addForm.salary);
      if (validSchedule.length > 0) staffData.weekSchedule = validSchedule;
      if (addForm.notes) staffData.notes = addForm.notes;
      staffData.notesHistory = []; // Initialize empty history

      await setDoc(doc(db, "gyms", gymId, "staff", staffId), staffData);

      dismiss();
      toast({ title: "Success!", description: `${fullName} has been added.` });
      onOpenChange(false);
      setAddForm({ ...DEFAULT_STAFF_FORM });
      setPhotoFile(null);
      setPhotoPreview(null);
      onSuccess?.();
    } catch (error) {
      dismiss();
      console.error("Error adding staff:", error);
      toast({ title: "Error", description: "Failed to add staff.", variant: "destructive" });
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !isAdding && onOpenChange(v)}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto bg-[#0F0F1A] border-white/[0.08] text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-[#B6916D]" />
            Add Staff Member
          </DialogTitle>
          <DialogDescription className="text-[#8888A0]">
            Enter the staff member details, salary, and weekly schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-col items-center justify-center gap-4 p-4 border border-dashed border-white/[0.1] rounded-lg bg-white/[0.02]">
            {photoPreview ? (
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#B6916D]">
                <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  className="absolute top-0 right-0 bg-transparent text-white p-1 rounded-full bg-black/50 hover:bg-black/80 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Label htmlFor="staff-photo-dash" className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-20 h-20 rounded-full bg-white/[0.04] flex items-center justify-center border-2 border-white/[0.1] group-hover:border-[#B6916D]/50 transition-colors">
                  <Camera className="h-8 w-8 text-[#8888A0] group-hover:text-[#B6916D] transition-colors" />
                </div>
                <span className="text-sm font-medium text-[#8888A0]">Upload Photo (Optional)</span>
                <input id="staff-photo-dash" type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              </Label>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Full Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Mike Johnson"
                value={addForm.fullName}
                onChange={(e) => setAddForm(p => ({ ...p, fullName: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Role <span className="text-destructive">*</span></Label>
              <Select value={addForm.role} onValueChange={(v) => setAddForm(p => ({ ...p, role: v || "Trainer" }))}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                  <SelectItem value="Trainer">Trainer</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Front Desk">Front Desk</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Email <span className="text-destructive">*</span></Label>
              <Input
                type="email"
                placeholder="user@gym.com"
                value={addForm.email}
                onChange={(e) => setAddForm(p => ({ ...p, email: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Phone <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. 555-0123"
                value={addForm.phone}
                onChange={(e) => setAddForm(p => ({ ...p, phone: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Salary (₹ / month)</Label>
              <Input
                type="number"
                placeholder="e.g. 25000"
                value={addForm.salary}
                onChange={(e) => setAddForm(p => ({ ...p, salary: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Status</Label>
              <Select value={addForm.status} onValueChange={(v) => setAddForm(p => ({ ...p, status: v || "Active" }))}>
                <SelectTrigger className="bg-white/[0.04] border-white/[0.08] h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#0F0F1A] border-white/[0.08] text-white">
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[#8888A0]">Joining Date</Label>
              <Input
                type="date"
                value={addForm.joiningDate}
                onChange={(e) => setAddForm(p => ({ ...p, joiningDate: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[#8888A0]">Certifications (comma separated)</Label>
              <Input
                placeholder="e.g. NASM-CPT, ACE-PT"
                value={addForm.certifications}
                onChange={(e) => setAddForm(p => ({ ...p, certifications: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[#8888A0]">Specialties (comma separated)</Label>
              <Input
                placeholder="e.g. Strength Training, HIIT"
                value={addForm.specialties}
                onChange={(e) => setAddForm(p => ({ ...p, specialties: e.target.value }))}
                className="bg-white/[0.04] border-white/[0.08] focus:border-[#B6916D]/50"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-[#8888A0]">Notes</Label>
              <textarea
                placeholder="Add internal notes about the staff member..."
                value={addForm.notes}
                onChange={(e) => setAddForm(p => ({ ...p, notes: e.target.value }))}
                className="w-full min-h-[100px] p-3 rounded-md bg-white/[0.04] border border-white/[0.08] text-white focus:outline-none focus:ring-1 focus:ring-[#B6916D] placeholder:text-white/20 text-sm"
              />
            </div>
          </div>

          {/* Week Schedule */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-white">Week Schedule</Label>
              <Button type="button" variant="outline" size="sm" className="text-xs bg-white/[0.04] border-white/[0.08] hover:bg-white/[0.08]" onClick={addScheduleDay}>
                + Add Day
              </Button>
            </div>
            {addForm.weekSchedule.map((slot, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                <div className="space-y-1">
                  <Label className="text-xs text-[#8888A0]">Day</Label>
                  <select
                    value={slot.day}
                    onChange={e => updateScheduleDay(idx, "day", e.target.value)}
                    className="w-full h-10 px-3 rounded-md border border-white/[0.08] bg-white/[0.04] text-sm text-white"
                  >
                    <option value="" className="bg-[#0F0F1A]">Select</option>
                    {DAYS_OF_WEEK.map(d => <option key={d} value={d} className="bg-[#0F0F1A]">{d}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#8888A0]">From</Label>
                  <Input className="bg-white/[0.04] border-white/[0.08]" type="time" value={slot.startTime} onChange={e => updateScheduleDay(idx, "startTime", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-[#8888A0]">To</Label>
                  <Input className="bg-white/[0.04] border-white/[0.08]" type="time" value={slot.endTime} onChange={e => updateScheduleDay(idx, "endTime", e.target.value)} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 mb-0.5" onClick={() => removeScheduleDay(idx)}>
                  ×
                </Button>
              </div>
            ))}
            {addForm.weekSchedule.length === 0 && (
              <p className="text-xs text-[#8888A0] text-center py-3 bg-white/[0.02] rounded-lg border border-dashed border-white/[0.1]">No schedule days added. Click "+ Add Day" above.</p>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-white/[0.08] pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isAdding} className="bg-transparent border-white/[0.08] hover:bg-white/[0.04] text-[#8888A0]">
            Cancel
          </Button>
          <Button onClick={handleAddStaff} disabled={isAdding} className="bg-[#B6916D] hover:bg-[#B6916D]/90 text-white font-semibold">
            {isAdding ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</> : "Add Staff"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
