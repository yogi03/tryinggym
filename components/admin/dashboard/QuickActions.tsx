"use client";

import { UserPlus, FileText, Wallet, Tag, Contact, ClipboardList, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

interface QuickActionsProps {
  onAddMember: () => void;
  onAddStaff: () => void;
  onAddInquiry: () => void;
  onAddTrial: () => void;
  mode?: "admin" | "front_desk";
}

export default function QuickActions({ onAddMember, onAddStaff, onAddInquiry, onAddTrial, mode = "admin" }: QuickActionsProps) {
  const router = useRouter();
  const { toast } = useToast();

  const actions = [
    { label: "Add Member", icon: UserPlus, action: "add-member" },
    { label: "Trial Pass", icon: Ticket, action: "add-trial" },
    { label: "Create Inquiry", icon: FileText, action: "add-inquiry" },
    // { label: "Record Payment", icon: Wallet, action: "coming-soon" },
    // { label: "Add Plan", icon: Tag, action: "coming-soon" },
    { label: "Add Staff", icon: Contact, action: "add-staff" },
    // { label: "View Attendance", icon: ClipboardList, action: "coming-soon" },
  ];

  const visibleActions = mode === "front_desk"
    ? actions.filter((action) => ["add-member", "add-trial", "add-inquiry", "add-staff"].includes(action.action))
    : actions;

  const handleAction = (action: string) => {
    switch (action) {
      case "add-member":
        onAddMember();
        break;
      case "add-staff":
        onAddStaff();
        break;
      case "add-inquiry":
        onAddInquiry();
        break;
      case "add-trial":
        onAddTrial();
        break;
      default:
        toast({ title: "Coming Soon", description: "This feature will be available in a future update." });
    }
  };

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {visibleActions.map((a) => (
        <button
          key={a.label}
          onClick={() => handleAction(a.action)}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg bg-[#B6916D]/90 hover:bg-[#B6916D] text-white text-xs sm:text-sm font-medium transition-all duration-200 hover:shadow-lg hover:shadow-[#B6916D]/20 active:scale-[0.97]"
        >
          <a.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          {a.label}
        </button>
      ))}
    </div>
  );
}
