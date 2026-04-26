"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/config";
import { collection, getDocs } from "firebase/firestore";
import { Member } from "@/types";
import AdminSidebar from "@/components/admin/Sidebar";
import { Loader2, Users, CreditCard, Activity, Target, AlertTriangle, TrendingUp, IndianRupee } from "lucide-react";
import { AnalyticsCard } from "@/components/admin/analytics/AnalyticsCard";
import DashboardRevenueChart from "@/components/admin/dashboard/DashboardRevenueChart";
import { MemberInsights } from "@/components/admin/analytics/MemberInsights";
import { AIInsights } from "@/components/admin/analytics/AIInsights";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell as BarCell } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function AnalyticsPage() {
  const { adminData, activeGym, loading: authLoading } = useAuth();
  const router = useRouter();
  const gymId = adminData?.gymId;
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [dateRange, setDateRange] = useState("30"); // 30 days
  const [drillDownRecipient, setDrillDownRecipient] = useState<string | null>(null);
  const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444'];

  useEffect(() => {
    if (!gymId) return;

    setLoading(true);
    setMembers([]);
    setPayments([]);
    let cancelled = false;

    const fetchData = async () => {
      try {
        const [membersSnapshot, paymentsSnapshot] = await Promise.all([
          getDocs(collection(db, "gyms", gymId, "members")),
          getDocs(collection(db, "gyms", gymId, "payments")),
        ]);

        if (cancelled) return;

        const membersData = membersSnapshot.docs.map(doc => ({
          memberId: doc.id,
          ...doc.data()
        })) as Member[];
        const paymentsData = paymentsSnapshot.docs.map(doc => doc.data());

        setMembers(membersData);
        setPayments(paymentsData);
      } catch (error) {
        console.error("Analytics fetch error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [gymId]);

  // Derived calculations using useMemo for performance
  const analyticsData = useMemo(() => {
    const msDay = 1000 * 60 * 60 * 24;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rangeInfo = (() => {
      if (dateRange === "year") {
        const start = new Date(today.getFullYear() - 3, 0, 1); // 4 years lookback
        return { start, label: "Growth Trend", type: "year", durationDays: 1460 };
      }
      if (dateRange === "monthly") {
        const start = new Date(today.getFullYear(), today.getMonth(), 1);
        return { start, label: "This Month", type: "monthly", durationDays: today.getDate() };
      }
      if (dateRange === "quarter") {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
        const start = new Date(today.getFullYear(), quarterStartMonth, 1);
        const durationDays = Math.max(1, Math.ceil((today.getTime() - start.getTime()) / msDay) + 1);
        return { start, label: "This Quarter", type: "quarter", durationDays, quarterStartMonth };
      }
      const start = new Date(today);
      start.setDate(start.getDate() - 29);
      return { start, label: "Last 30 Days", type: "30", durationDays: 30 };
    })();

    const prevEnd = new Date(rangeInfo.start);
    prevEnd.setDate(prevEnd.getDate() - 1);
    const prevStart = new Date(prevEnd);
    prevStart.setDate(prevStart.getDate() - (rangeInfo.durationDays - 1));

    // Member basic stats
    const totalMembers = members.length;
    let activeMembersCount = 0;
    let inactiveMembersCount = 0;
    let expiringSoonCount = 0;

    let mrr = 0;
    const planCounts: Record<string, number> = {};
    const atRiskMembers: Member[] = [];

    const newMembersRange = members.filter(m => m.createdAt && new Date(m.createdAt) >= rangeInfo.start && m.membershipType !== 'trial').length;
    const newMembersPrev = members.filter(m => m.createdAt && new Date(m.createdAt) >= prevStart && new Date(m.createdAt) <= prevEnd && m.membershipType !== 'trial').length;

    const trialsInRange = members.filter(m => {
      if (!m.createdAt) return false;
      const createdDate = new Date(m.createdAt);
      const isTrialStart = m.planHistory?.some(p => p.planType === 'trial');
      return createdDate >= rangeInfo.start && isTrialStart;
    });

    const newTrialsRange = trialsInRange.length;
    const newTrialsPrev = members.filter(m => {
      if (!m.createdAt) return false;
      const d = new Date(m.createdAt);
      return d >= prevStart && d <= prevEnd && m.planHistory?.some(p => p.planType === 'trial');
    }).length;

    const trialsConverted = trialsInRange.filter(m => m.planHistory?.some(p => p.planType !== 'trial')).length;
    const trialsDroppedOut = trialsInRange.filter(m => {
      const hasProperPlan = m.planHistory?.some(p => p.planType !== 'trial');
      const trialExpired = new Date(m.membershipEndDate) < today;
      return !hasProperPlan && trialExpired;
    }).length;

    const recentActivity = members
      .filter(m => m.createdAt && new Date(m.createdAt) >= rangeInfo.start)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(m => ({
        memberId: m.memberId,
        fullName: m.fullName,
        phone: m.phone,
        type: m.membershipType === 'trial' ? 'Trial' : 'Joined',
        membershipType: m.membershipType,
        date: m.createdAt
      }));

    members.forEach(member => {
      const expiryDate = new Date(member.membershipEndDate);
      expiryDate.setHours(0, 0, 0, 0);
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / msDay);

      // Plan counts
      const plan = member.membershipType || "other";
      planCounts[plan] = (planCounts[plan] || 0) + 1;

      if (diffDays >= 0) {
        activeMembersCount++;
        if (diffDays <= 5) {
          expiringSoonCount++;
          atRiskMembers.push(member);
        }
      } else {
        if (diffDays < -10) {
          inactiveMembersCount++; // overdue > 10 days
        } else {
          atRiskMembers.push(member);
        }
      }

      if (diffDays >= 0) {
        const planCost = member.feesPaid || 0;
        if (plan === "monthly") mrr += planCost;
        if (plan === "quarterly") mrr += planCost / 3;
        if (plan === "half-yearly") mrr += planCost / 6;
        if (plan === "yearly") mrr += planCost / 12;
      }
    });

    const memberPaymentsMap: Record<string, number> = {};

    const paymentsInRange = payments.filter(p => {
      const d = new Date(p.date);
      d.setHours(0, 0, 0, 0);
      return d >= rangeInfo.start && d <= today;
    });
    const paymentsPrevRange = payments.filter(p => {
      const d = new Date(p.date);
      d.setHours(0, 0, 0, 0);
      return d >= prevStart && d <= prevEnd;
    });

    const rangeRevenue = paymentsInRange.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const prevRangeRevenue = paymentsPrevRange.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const revenueGrowth = prevRangeRevenue > 0 ? ((rangeRevenue - prevRangeRevenue) / prevRangeRevenue) * 100 : 0;

    const todayRevenue = payments.filter(p => {
      const d = new Date(p.date);
      return d.toDateString() === today.toDateString();
    }).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    payments.forEach(p => {
      const pDate = new Date(p.date);
      pDate.setHours(0, 0, 0, 0);
      memberPaymentsMap[p.memberId] = (memberPaymentsMap[p.memberId] || 0) + 1;
    });

    // Trend data by selected range
    let trendData: { date: string; revenue: number }[] = [];
    if (rangeInfo.type === "year") {
      for (let m = 0; m <= today.getMonth(); m++) {
        const monthRevenue = paymentsInRange
          .filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === m;
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        trendData.push({ date: MONTHS[m], revenue: monthRevenue });
      }
    } else if (rangeInfo.type === "quarter") {
      const startMonth = (rangeInfo as any).quarterStartMonth as number;
      const endMonth = Math.min(today.getMonth(), startMonth + 2);
      for (let m = startMonth; m <= endMonth; m++) {
        const monthRevenue = paymentsInRange
          .filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === m;
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        trendData.push({ date: MONTHS[m], revenue: monthRevenue });
      }
    } else {
      // default 30 days daily view
      for (let i = rangeInfo.durationDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
          .toString()
          .padStart(2, "0")}`;
        const dayRevenue = paymentsInRange
          .filter(p => {
            const pd = new Date(p.date);
            pd.setHours(0, 0, 0, 0);
            return pd.getTime() === d.getTime();
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        trendData.push({ date: dateStr, revenue: dayRevenue });
      }
    }

    const fullYearRevenueMap: Record<string, number> = {};
    MONTHS.forEach(m => { fullYearRevenueMap[m] = 0; });
    const currentYear = new Date().getFullYear();
    payments.forEach(p => {
      const d = new Date(p.date);
      if (d.getFullYear() === currentYear) {
        fullYearRevenueMap[MONTHS[d.getMonth()]] += Number(p.amount) || 0;
      }
    });
    const fullYearRevenueData = MONTHS.map(m => ({ month: m, revenue: fullYearRevenueMap[m] }));

    // Multi-year aggregation (Last 4 years including current)
    const multiYearMap: Record<number, number> = {};
    for (let i = currentYear - 3; i <= currentYear; i++) {
      multiYearMap[i] = 0;
    }
    payments.forEach(p => {
      const d = new Date(p.date);
      const y = d.getFullYear();
      if (multiYearMap[y] !== undefined) {
        multiYearMap[y] += Number(p.amount) || 0;
      }
    });
    const multiYearRevenueData = Object.keys(multiYearMap).sort().map(y => ({ 
      month: y, 
      revenue: multiYearMap[Number(y)] 
    }));

    const planData = Object.keys(planCounts)
      .map(name => ({ name, value: planCounts[name] }))
      .filter(p => p.value > 0);

    const churnRate = totalMembers > 0 ? ((totalMembers - activeMembersCount) / totalMembers) * 100 : 0;
    const newMembersGrowth = newMembersPrev > 0 ? ((newMembersRange - newMembersPrev) / newMembersPrev) * 100 : newMembersRange > 0 ? 100 : 0;
    const newTrialsGrowth = newTrialsPrev > 0 ? ((newTrialsRange - newTrialsPrev) / newTrialsPrev) * 100 : newTrialsRange > 0 ? 100 : 0;

    const consistentMembersIds = Object.entries(memberPaymentsMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(e => e[0]);
    const consistentMembers = consistentMembersIds
      .map(id => members.find(m => m.memberId === id))
      .filter(Boolean) as Member[];

    const insights = [];
    if (inactiveMembersCount > totalMembers * 0.2) {
      insights.push({
        id: "1",
        type: "warning",
        title: "High Inactive Volume",
        message: `You have ${inactiveMembersCount} users inactive for >10 days. Consider sending a reactivation offer via WhatsApp.`,
      });
    }
    if (revenueGrowth < 0) {
      insights.push({
        id: "2",
        type: "warning",
        title: "Revenue Decrease",
        message: `Revenue is down ${Math.abs(revenueGrowth).toFixed(1)}% compared to the previous period.`,
      });
    } else if (revenueGrowth > 5) {
      insights.push({
        id: "3",
        type: "success",
        title: "Healthy Growth",
        message: `Revenue is up ${revenueGrowth.toFixed(1)}% over the last period.`,
      });
    }
    if (planCounts["monthly"] > totalMembers * 0.5) {
      insights.push({
        id: "4",
        type: "info",
        title: "Promote Long-Term Plans",
        message: `Over 50% of members are on Monthly plans. Promote quarterly/yearly plans to improve retention.`,
      });
    }
    if (expiringSoonCount > 5) {
      insights.push({
        id: "5",
        type: "action",
        title: "Action Needed: Renewals",
        message: `${expiringSoonCount} members are expiring within 5 days! Remind them today to keep your MRR stable.`,
      });
    }

    const topPlan = Object.entries(planCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "n/a";

    // Revenue by Recipient
    const recipientRevenueMap: Record<string, number> = {};
    paymentsInRange.forEach(p => {
      const receivedByRaw = p.receivedBy || "Unassigned";
      
      // Handle legacy joined strings or multi-recipient entries (e.g., "Rahul / Vipin")
      if (receivedByRaw.includes(" / ") || (receivedByRaw.includes("/") && receivedByRaw.length > 3)) {
        const recipients = receivedByRaw.split(/\s*\/\s*/).filter(Boolean);
        const splitAmount = (Number(p.amount) || 0) / recipients.length;
        recipients.forEach(r => {
          recipientRevenueMap[r] = (recipientRevenueMap[r] || 0) + splitAmount;
        });
      } else {
        recipientRevenueMap[receivedByRaw] = (recipientRevenueMap[receivedByRaw] || 0) + (Number(p.amount) || 0);
      }
    });
    const recipientRevenueData = Object.entries(recipientRevenueMap)
      .map(([name, revenue]) => ({ name, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      totalMembers,
      activeMembersCount,
      inactiveMembersCount,
      expiringSoonCount,
      newMembersRange,
      newMembersGrowth,
      newTrialsRange,
      newTrialsGrowth,
      trialsConverted,
      trialsDroppedOut,
      mrr: Math.round(mrr),
      rangeRevenue,
      revenueGrowth,
      paymentsCount: paymentsInRange.length,
      avgTicket: paymentsInRange.length ? Math.round(rangeRevenue / paymentsInRange.length) : 0,
      churnRate,
      trendData,
      planData,
      consistentMembers,
      atRiskMembers: atRiskMembers.slice(0, 5),
      insights: insights.slice(0, 4) as any,
      rangeLabel: rangeInfo.label,
      topPlan,
      todayRevenue,
      fullYearRevenueData,
      multiYearRevenueData,
      recipientRevenueData,
      recentActivity
    };
  }, [members, payments, dateRange]);

  const recipientMemberDetails = useMemo(() => {
    if (!drillDownRecipient) return [];

    const details: Record<string, { name: string; phone: string; total: number }> = {};
    
    // Exact same split and filter logic as recipientRevenueData
    const rangeInfo = {
      start: new Date(),
    };
    const today = new Date();
    today.setHours(0,0,0,0);
    if (dateRange === "30") rangeInfo.start.setDate(today.getDate() - 30);
    else if (dateRange === "month") rangeInfo.start.setDate(1);
    else if (dateRange === "quarter") {
      const q = Math.floor(today.getMonth() / 3);
      rangeInfo.start.setMonth(q * 3, 1);
    } else if (dateRange === "year") rangeInfo.start.setMonth(0, 1);
    rangeInfo.start.setHours(0,0,0,0);

    payments
      .filter(p => {
        const d = new Date(p.date);
        d.setHours(0,0,0,0);
        return d >= rangeInfo.start && d <= today;
      })
      .forEach(p => {
        const raw = p.receivedBy || "Unassigned";
        const isSplit = raw.includes(" / ") || (raw.includes("/") && raw.length > 3);
        const recipients = isSplit ? raw.split(/\s*\/\s*/).filter(Boolean) : [raw];
        
        if (recipients.some(r => r.toLowerCase().trim() === drillDownRecipient.toLowerCase().trim())) {
          const amount = (Number(p.amount) || 0) / (isSplit ? recipients.length : 1);
          const member = members.find(m => m.memberId === p.memberId);
          const memberId = p.memberId || "unknown";
          
          if (!details[memberId]) {
            details[memberId] = {
              name: member?.fullName || "Deleted Member",
              phone: member?.phone || "N/A",
              total: 0
            };
          }
          details[memberId].total += amount;
        }
      });

    return Object.entries(details)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.total - a.total);
  }, [drillDownRecipient, members, payments, dateRange]);

  if (authLoading || loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0F0F1A]">
        <Loader2 className="h-8 w-8 animate-spin text-[#B6916D]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0F0F1A] flex-col lg:flex-row text-foreground">
      <AdminSidebar />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 pt-12 lg:pt-0">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground text-sm">Data-driven insights to grow your gym.</p>
          </div>
          <div className="flex rounded-lg border border-white/[0.08] overflow-hidden p-0.5 bg-white/[0.02]">
            {[
              { id: "30", label: "30 Days" },
              { id: "monthly", label: "Monthly" },
              { id: "quarter", label: "Quarter" },
              { id: "year", label: "Year" },
            ].map((opt) => {
              const active = dateRange === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setDateRange(opt.id)}
                  className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${active ? "bg-orange-600 text-white shadow-lg shadow-orange-500/20" : "text-[#8888A0] hover:text-white hover:bg-white/[0.04]"}`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 1. KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          <AnalyticsCard 
            title="Today's Collection" 
            value={`₹${analyticsData.todayRevenue.toLocaleString()}`} 
            icon={<CreditCard className="w-5 h-5" />} 
            className="border-[#B6916D]/20 shadow-[0_0_15px_rgba(182,145,109,0.1)]"
          />
          <AnalyticsCard 
            title={`Revenue (${analyticsData.rangeLabel})`} 
            value={`₹${analyticsData.rangeRevenue.toLocaleString()}`} 
            icon={<IndianRupee className="w-5 h-5" />} 
            trend={{ 
              value: Math.round(Math.abs(analyticsData.revenueGrowth)), 
              label: "vs previous period", 
              isPositive: analyticsData.revenueGrowth >= 0 
            }}
          />
          <AnalyticsCard 
            title="Active Members" 
            value={analyticsData.activeMembersCount} 
            icon={<Users className="w-5 h-5" />} 
            trend={{
              value: Number(analyticsData.churnRate.toFixed(1)),
              label: "churn rate",
              isPositive: analyticsData.churnRate < 10
            }}
          />
          <AnalyticsCard 
            title={`New Members (${analyticsData.rangeLabel})`} 
            value={analyticsData.newMembersRange} 
            icon={<Target className="w-5 h-5" />} 
            trend={{
              value: Math.round(analyticsData.newMembersGrowth),
              label: "vs previous period",
              isPositive: analyticsData.newMembersGrowth >= 0
            }}
          />
          <AnalyticsCard 
            title={`New Trials (${analyticsData.rangeLabel})`} 
            value={analyticsData.newTrialsRange} 
            icon={<Activity className="w-5 h-5 text-emerald-400" />} 
            trend={{
              value: Math.round(analyticsData.newTrialsGrowth),
              label: "vs previous period",
              isPositive: analyticsData.newTrialsGrowth >= 0
            }}
          />
          <AnalyticsCard 
            title="Inactive (>10 days)" 
            value={analyticsData.inactiveMembersCount} 
            icon={<AlertTriangle className="w-5 h-5" />} 
            className="border-red-500/20"
          />
        </div>

        {/* 2. Revenue & Plan Analytics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <DashboardRevenueChart 
              data={
                dateRange === "30" 
                  ? analyticsData.trendData.map(d => ({ month: d.date, revenue: d.revenue })) 
                  : dateRange === "year"
                    ? analyticsData.multiYearRevenueData as any
                    : analyticsData.fullYearRevenueData
              } 
              title={dateRange === "year" ? "Annual Growth Trend" : "Revenue Trend"}
              subtitle={
                dateRange === "30" 
                  ? "Daily revenue trend (Last 30 Days)" 
                  : dateRange === "monthly"
                    ? "12-month revenue analysis (Current Year)"
                    : dateRange === "quarter" 
                      ? "Quarterly revenue analysis (Current Year)" 
                      : "Multi-year revenue comparison"
              }
              showControls={false}
              externalPeriod={dateRange === "quarter" ? "Quarterly" : "Monthly"}
            />
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm p-6 flex flex-col">
            <h3 className="text-base font-semibold mb-6">Revenue by Plan</h3>
            <div className="flex-1 min-h-[250px] w-full flex items-center justify-center">
              {analyticsData.planData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analyticsData.planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {analyticsData.planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: "#1E1E3A", border: "1px solid #ffffff15", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
                      formatter={(value: any) => [`${value}`, "Members"]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-[#8888A0] text-sm">No data available</p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 justify-center">
              {analyticsData.planData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-2 text-[10px] sm:text-xs">
                  <div className="w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.4)]" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                  <span className="text-[#8888A0] capitalize font-medium">{entry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Revenue by Admin Breakdown */}
        <div className="grid grid-cols-1 gap-6 mb-8">
          <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-semibold text-white">Revenue by Recipient (Admin)</h3>
                <p className="text-xs text-[#8888A0]">Breakdown of fees received by each admin/staff ({analyticsData.rangeLabel})</p>
              </div>
              <TrendingUp className="h-4 w-4 text-[#B6916D] opacity-50" />
            </div>
            
            <div className="h-[300px] w-full">
              {analyticsData.recipientRevenueData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.recipientRevenueData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff05" vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#8888A0', fontSize: 11 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#8888A0', fontSize: 11 }} 
                      tickFormatter={(value) => `₹${value}`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                      contentStyle={{ backgroundColor: "#1E1E3A", border: "1px solid #ffffff15", borderRadius: "10px", color: "#fff" }}
                      formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]}
                    />
                    <Bar 
                      dataKey="revenue" 
                      fill="#B6916D" 
                      radius={[4, 4, 0, 0]} 
                      barSize={40}
                      className="cursor-pointer"
                      onClick={(data) => {
                        if (data && data.name) setDrillDownRecipient(data.name);
                      }}
                    >
                      {analyticsData.recipientRevenueData.map((entry, index) => (
                        <BarCell key={`cell-${index}`} className="hover:opacity-80 transition-opacity" />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-[#8888A0] text-sm italic">
                  No multi-recipient payment data available for this period
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 4. Trial Conversion Analytics */}
        <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-base font-semibold text-white">Trial Conversion Analytics</h3>
              <p className="text-xs text-[#8888A0]">Tracking effectiveness of trial passes ({analyticsData.rangeLabel})</p>
            </div>
            <Activity className="h-5 w-5 text-[#B6916D] font-bold opacity-50" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-bold">Total Trials Started</p>
              <p className="text-3xl font-bold">{analyticsData.newTrialsRange}</p>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-bold">Converted to Membership</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-emerald-400">{analyticsData.trialsConverted}</p>
                <p className="text-xs text-emerald-500/60 font-bold">
                  ({analyticsData.newTrialsRange > 0 ? Math.round((analyticsData.trialsConverted / analyticsData.newTrialsRange) * 100) : 0}%)
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-bold">Just Trial (Not Opted)</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold text-red-400">{analyticsData.trialsDroppedOut}</p>
                <p className="text-xs text-red-500/60 font-bold">
                  ({analyticsData.newTrialsRange > 0 ? Math.round((analyticsData.trialsDroppedOut / analyticsData.newTrialsRange) * 100) : 0}%)
                </p>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-3">
               <div className="flex justify-between items-center text-[10px] uppercase tracking-wider font-bold">
                  <span className="text-[#8888A0]">Conversion Rate</span>
                  <span className="text-emerald-400 font-bold">{analyticsData.newTrialsRange > 0 ? Math.round((analyticsData.trialsConverted / analyticsData.newTrialsRange) * 100) : 0}%</span>
               </div>
               <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden flex">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-1000" 
                    style={{ width: `${analyticsData.newTrialsRange > 0 ? (analyticsData.trialsConverted / analyticsData.newTrialsRange) * 100 : 0}%` }}
                  />
                  <div 
                    className="h-full bg-red-500/40 transition-all duration-1000" 
                    style={{ width: `${analyticsData.newTrialsRange > 0 ? (analyticsData.trialsDroppedOut / analyticsData.newTrialsRange) * 100 : 0}%` }}
                  />
               </div>
               <div className="flex gap-4">
                  <div className="flex items-center gap-1.5 text-[9px] text-[#8888A0]">
                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Converted
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] text-[#8888A0]">
                     <div className="w-1.5 h-1.5 rounded-full bg-red-500/40" /> Dropouts
                  </div>
               </div>
            </div>
          </div>
        </div>

        {/* 2. Additional breakdown */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm group hover:border-white/[0.12] transition-all duration-300">
            <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-medium">Approx MRR</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">₹{analyticsData.mrr.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm group hover:border-white/[0.12] transition-all duration-300">
            <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-medium">Avg Ticket ({analyticsData.rangeLabel})</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">₹{analyticsData.avgTicket.toLocaleString()}</p>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm group hover:border-white/[0.12] transition-all duration-300">
            <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-medium">Payments in period</p>
            <p className="text-2xl font-bold mt-1 tracking-tight">{analyticsData.paymentsCount}</p>
          </div>
          <div className="p-4 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm group hover:border-white/[0.12] transition-all duration-300">
            <p className="text-[10px] uppercase tracking-wider text-[#8888A0] font-medium">Top Plan (all time)</p>
            <p className="text-2xl font-bold mt-1 tracking-tight capitalize">{analyticsData.topPlan}</p>
          </div>
        </div>

        {/* 3. AI Insights Panel */}
        <div className="mb-8">
          <AIInsights insights={analyticsData.insights} />
        </div>

        {/* 4. Member Behavior Settings */}
        <div className="mb-8">
           <MemberInsights 
             consistentMembers={analyticsData.consistentMembers}
             atRiskMembers={analyticsData.atRiskMembers}
             recentActivity={analyticsData.recentActivity}
             newMembersCount={analyticsData.newMembersRange}
             gymName={activeGym?.name || "Gym"} 
           />
        </div>


        {/* Recipient Drill Down Dialog */}
        <Dialog open={!!drillDownRecipient} onOpenChange={(open) => !open && setDrillDownRecipient(null)}>
          <DialogContent className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl bg-[#0F0F1A] border-white/[0.08] text-foreground overflow-hidden">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-xl flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0 sm:justify-between">
                <span className="truncate pr-2">Collection Details: {drillDownRecipient}</span>
                <span className="text-emerald-400 text-lg font-bold sm:mr-8 shrink-0">₹{recipientMemberDetails.reduce((sum, item) => sum + item.total, 0).toLocaleString()}</span>
              </DialogTitle>
              <DialogDescription className="text-[#8888A0]">
                List of members and amounts received by {drillDownRecipient} in the selected period.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-4 max-h-[65vh] overflow-y-auto overflow-x-hidden custom-scrollbar">
              <Table className="min-w-full table-fixed">
                <TableHeader className="bg-white/[0.02]">
                  <TableRow className="border-white/[0.08] hover:bg-transparent">
                    <TableHead className="text-[#8888A0] font-bold w-[45%]">Member Name</TableHead>
                    <TableHead className="text-[#8888A0] font-bold w-[35%]">Phone Number</TableHead>
                    <TableHead className="text-right text-[#8888A0] font-bold w-[20%]">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recipientMemberDetails.length > 0 ? (
                    recipientMemberDetails.map((item) => (
                      <TableRow 
                        key={item.id} 
                        className="border-white/[0.04] hover:bg-white/[0.04] cursor-pointer group transition-colors"
                        onClick={() => {
                          setDrillDownRecipient(null);
                          router.push(`/admin/member/${item.id}`);
                        }}
                      >
                        <TableCell className="font-semibold group-hover:text-primary transition-colors truncate">
                          {item.name}
                        </TableCell>
                        <TableCell className="text-[#8888A0] font-mono text-xs sm:text-sm">
                          {item.phone}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-400 whitespace-nowrap">
                          ₹{item.total.toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-[#8888A0] italic">
                        No detailed data found for this recipient.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
