"use client";

import { useState } from "react";
import { Member } from "@/types";
import { format, isAfter, parseISO } from "date-fns";
import { Button } from "@/components/ui/button";
import { Eye, RefreshCw, Filter, Loader2, Calendar, User, Zap } from "lucide-react";
import RenewMembershipPopover from "../RenewMembershipPopover";
import { useRouter } from "next/navigation";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth/auth-context";
import { useToast } from "@/hooks/use-toast";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc, addDoc, collection } from "firebase/firestore";

interface UpcomingRenewalsProps {
  members: Member[];
}

const FILTER_OPTIONS = [
  { label: "Next 7 days", days: 7 },
  { label: "14 days", days: 14 },
  { label: "30 days", days: 30 },
];

const RENEWAL_OPTIONS = [
  { label: "Monthly (1 Month)", months: 1 },
  { label: "Quarterly (3 Months)", months: 3 },
  { label: "Half-Yearly (6 Months)", months: 6 },
  { label: "Yearly (12 Months)", months: 12 },
];

function getPlanBadgeColor(plan: string): string {
  switch (plan) {
    case "yearly": return "bg-purple-500/15 text-purple-400 border-purple-500/20";
    case "half-yearly": return "bg-blue-500/15 text-blue-400 border-blue-500/20";
    case "quarterly": return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "monthly": return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "trial": return "bg-orange-500/15 text-orange-400 border-orange-500/20";
    default: return "bg-gray-500/15 text-gray-400 border-gray-500/20";
  }
}

function getStatusInfo(endDate: string): { label: string; class: string } {
  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(endDate);
  end.setHours(0,0,0,0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diff < 0) return { label: "Expired", class: "bg-red-500/15 text-red-500 border-red-500/20" };
  if (diff <= 5) return { label: "Expiring", class: "bg-orange-500/15 text-orange-500 border-orange-500/20" };
  return { label: "Active", class: "bg-emerald-500/15 text-emerald-500 border-emerald-500/20" };
}

function getDaysLeft(endDate: string): string {
  const today = new Date();
  today.setHours(0,0,0,0);
  const end = new Date(endDate);
  end.setHours(0,0,0,0);
  const diff = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return "Today";
  return `${diff} days left`;
}



export default function UpcomingRenewals({ members }: UpcomingRenewalsProps) {
  const [filterDays, setFilterDays] = useState(7);
  const router = useRouter();
  const { activeGym } = useAuth();

  const handleSendReminder = (member: Member) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(member.membershipEndDate);
    expiryDate.setHours(0, 0, 0, 0);
    
    const isExpired = expiryDate < today;
    const dateStr = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const gymName = activeGym?.name || "Gym";
    
    let message = "";
    if (isExpired) {
      message = `Hi ${member.fullName}, your membership at ${gymName} has expired on ${dateStr}. We miss you! Renew now to get back to the gym. 🏋️‍♂️`;
    } else {
      message = `Hi ${member.fullName}, your membership at ${gymName} is expiring on ${dateStr}. Renew now to continue your fitness journey! 💪`;
    }

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/91${member.phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const today = new Date();
  today.setHours(0,0,0,0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + filterDays);

  const filtered = members
    .filter((m) => {
      // Logic for filtering upcoming plans: 
      // check if any plan history has a start date in the future
      const hasUpcomingPlan = m.planHistory?.some(p => isAfter(parseISO(p.startDate), today));
      if (hasUpcomingPlan) return false;

      const end = new Date(m.membershipEndDate);
      end.setHours(0,0,0,0);
      // We show even overdue (expired) in "Upcoming" if they haven't renewed?
      // Usually "Upcoming" implies future, but in gym management, we want to see who missed as well.
      // Filter logic: end date <= cutoff
      return end <= cutoff;
    })
    .sort((a, b) => new Date(a.membershipEndDate).getTime() - new Date(b.membershipEndDate).getTime());

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-6 pb-0 sm:pb-0">
        <div>
          <h3 className="text-base sm:text-lg font-semibold text-white">Upcoming Renewals</h3>
          <p className="text-xs text-[#8888A0]">Members with upcoming or expired membership renewals</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setFilterDays(opt.days)}
                className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors ${filterDays === opt.days ? "bg-[#6F51FF] text-white" : "text-[#8888A0] hover:text-white hover:bg-white/[0.04]"}`}
              >
                {opt.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-white/[0.06] text-[#8888A0]">
              <th className="text-left font-medium py-3 px-4 sm:px-6">Member</th>
              <th className="text-left font-medium py-3 px-2">Nickname</th>
              <th className="text-left font-medium py-3 px-2">Plan</th>
              <th className="text-left font-medium py-3 px-2">Training</th>
              <th className="text-left font-medium py-3 px-2">Renewal Date</th>
              <th className="text-left font-medium py-3 px-2">Last Paid</th>
              <th className="text-left font-medium py-3 px-2">Status</th>
              <th className="text-right font-medium py-3 px-4 sm:px-6">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-[#8888A0]">
                  <p className="text-sm">No upcoming renewals in this period</p>
                </td>
              </tr>
            ) : (
              filtered.map((member) => {
                const status = getStatusInfo(member.membershipEndDate);
                const lastPlanAmt = member.planHistory && member.planHistory.length > 0 
                  ? member.planHistory[member.planHistory.length - 1].amountPaid 
                  : member.feesPaid;
                
                return (
                  <tr 
                    key={member.memberId} 
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group cursor-pointer"
                    onClick={() => router.push(`/admin/member/${member.memberId}`)}
                  >
                    <td className="py-3 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-white/10 overflow-hidden flex items-center justify-center shrink-0">
                          {member.photoUrl ? (
                            <img src={member.photoUrl} alt={member.fullName} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-white/70">{member.fullName.substring(0, 2).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm truncate text-white">{member.fullName}</p>
                          <p className="text-[11px] text-[#8888A0] truncate">ID: #{member.memberId.slice(0,8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-sm text-[#8888A0]">
                      {member.nickname || "—"}
                    </td>
                    <td className="py-3 px-2 uppercase">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${getPlanBadgeColor(member.membershipType)}`}>
                        {member.membershipType}
                      </span>
                    </td>
                    <td className="py-3 px-2">
                       <div className="flex items-center gap-1.5">
                        {member.trainingType === "personal" ? (
                          <div className="flex items-center gap-1 text-purple-400">
                            <Zap className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">PT</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-blue-400">
                            <User className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase">GT</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div>
                        <p className="text-sm text-white/90">{format(new Date(member.membershipEndDate), "MMM dd, yyyy")}</p>
                        <p className={`text-[11px] ${status.label === 'Expired' ? 'text-red-400' : 'text-emerald-400'}`}>{getDaysLeft(member.membershipEndDate)}</p>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <span className="text-sm text-white/90 font-medium">₹{(lastPlanAmt || 0).toLocaleString()}</span>
                    </td>
                    <td className="py-3 px-2">
                       <div className="flex flex-col items-start gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${status.class}`}>
                          {status.label}
                        </span>
                        {(status.label === 'Expired' || status.label === 'Expiring') && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendReminder(member);
                            }}
                            className="text-[10px] text-green-500 hover:text-green-400 font-medium whitespace-nowrap"
                          >
                            Send Reminder
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 sm:px-6 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-[#8888A0] hover:text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/admin/member/${member.memberId}`);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <div onClick={(e) => e.stopPropagation()}>
                          <RenewMembershipPopover member={member} onUpdate={() => {}} align="end" />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
