import { Member } from "@/types";
import { useRouter } from "next/navigation";

interface MemberInsightsProps {
  consistentMembers: Member[];
  atRiskMembers: Member[];
  recentActivity: { memberId: string; fullName: string; phone: string; type: 'Joined' | 'Trial'; date: string }[];
  newMembersCount: number;
  gymName: string;
}

export function MemberInsights({ consistentMembers, atRiskMembers, recentActivity, newMembersCount, gymName }: MemberInsightsProps) {
  const router = useRouter();
  const handleSendReminder = (member: Member) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiryDate = new Date(member.membershipEndDate);
    expiryDate.setHours(0, 0, 0, 0);
    
    const isExpired = expiryDate < today;
    const dateStr = expiryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    
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

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Consistent Members */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Most Consistent Members</h3>
            <span className="text-xs bg-green-500/10 text-green-500 px-2 py-1 rounded-md">Top Loyal</span>
          </div>
          <div className="space-y-4">
            {consistentMembers.length > 0 ? consistentMembers.map((member) => (
              <div 
                key={member.memberId} 
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.04] cursor-pointer"
                onClick={() => router.push(`/admin/member/${member.memberId}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center border border-white/10 bg-primary/20 text-primary text-xs font-semibold">
                    {member.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.fullName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{member.membershipType} Plan</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{member.phone}</p>
                  <p className="text-xs text-muted-foreground">Active Member</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">No consistent members found.</p>
            )}
          </div>
        </div>

        {/* At Risk Members */}
        <div className="p-6 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">At-Risk Members</h3>
            <span className="text-xs bg-red-500/10 text-red-500 px-2 py-1 rounded-md">Needs Attention</span>
          </div>
          <div className="space-y-4">
            {atRiskMembers.length > 0 ? atRiskMembers.map((member) => (
              <div 
                key={member.memberId} 
                className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] transition-colors border border-white/[0.04] cursor-pointer"
                onClick={() => router.push(`/admin/member/${member.memberId}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full flex items-center justify-center border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-semibold">
                    {member.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{member.fullName}</p>
                    <p className="text-xs text-red-400 capitalize">Expired / Due</p>
                  </div>
                </div>
                <div className="text-right flex flex-col items-end gap-1">
                  <p className="text-sm font-semibold">{member.phone}</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSendReminder(member);
                    }}
                    className="text-[10px] text-emerald-500 hover:text-emerald-400 font-bold uppercase tracking-wider"
                  >
                    Send Reminder
                  </button>
                </div>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground text-center py-4">No at-risk members found. Great job!</p>
            )}
          </div>
        </div>
      </div>

      {/* Recent Activity List */}
      <div className="p-6 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-semibold">Recent Joiners & Trials</h3>
            <p className="text-xs text-[#8888A0]">Members who joined or took a trial in this period</p>
          </div>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md border border-primary/20">
            {recentActivity.length} Total
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {recentActivity.length > 0 ? recentActivity.map((activity, idx) => (
            <div 
              key={`${activity.memberId}-${idx}`} 
              className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/[0.04] hover:bg-white/[0.05] transition-all group cursor-pointer"
              onClick={() => router.push(`/admin/member/${activity.memberId}`)}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center border shrink-0 font-bold text-xs ${
                  activity.type === 'Trial' 
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500" 
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                }`}>
                  {activity.fullName.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{activity.fullName}</p>
                  <p className="text-[10px] text-muted-foreground">{activity.phone}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className={`px-2 py-0.5 rounded-[4px] text-[9px] font-bold uppercase tracking-wider block mb-1 border ${
                  activity.type === 'Trial'
                    ? "bg-amber-500/10 border-amber-500/20 text-amber-500 font-bold"
                    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-bold"
                }`}>
                  {activity.type}
                </span>
                <p className="text-[10px] text-muted-foreground font-medium">
                  {new Date(activity.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
          )) : (
            <div className="col-span-full py-12 text-center text-[#8888A0] bg-white/[0.01] rounded-xl border border-dashed border-white/10">
              <p className="text-sm">No new members or trials in this period.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
