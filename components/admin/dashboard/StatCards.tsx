"use client";

import { Users, UserPlus, TrendingDown, IndianRupee, CalendarCheck, FileWarning } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: number;
  sparkData?: number[];
  color: string;
}

function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const h = 40, w = 120;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 8) - 4;
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <svg width={w} height={h} className="opacity-60">
      <defs>
        <linearGradient id={`grad-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace("#","")})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StatCard({ title, value, icon, trend, sparkData, color }: StatCardProps) {
  const isPositive = (trend ?? 0) >= 0;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm p-4 sm:p-5 flex flex-col gap-3 group hover:border-white/[0.12] transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm text-[#8888A0] font-medium tracking-wide">{title}</span>
        <div className="p-1.5 rounded-lg bg-white/[0.04]" style={{ color }}>
          {icon}
        </div>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</span>
          {trend !== undefined && (
            <span className={`text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md w-fit ${isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
              {isPositive ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
            </span>
          )}
        </div>
        <div className="hidden sm:block">
          <MiniSparkline data={sparkData || []} color={color} />
        </div>
      </div>
    </div>
  );
}

interface StatsData {
  totalMembers: number;
  activeMembers: number;
  newSignups: number;
  churnRate: number;
  mrr: number;
  attendanceToday: number;
  inactiveMembers: number;
  todayCollection: number;
}

function generateSparkData(base: number, count = 8): number[] {
  const data: number[] = [];
  let v = base * 0.85;
  for (let i = 0; i < count; i++) {
    v += (Math.random() - 0.4) * (base * 0.08);
    data.push(Math.max(0, Math.round(v)));
  }
  data[count - 1] = base;
  return data;
}

export default function DashboardStatCards({
  stats,
  mode = "admin",
}: {
  stats: StatsData;
  mode?: "admin" | "front_desk";
}) {
  if (mode === "front_desk") {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Inactive (>10 days)"
          value={stats.inactiveMembers}
          icon={<Users className="h-4 w-4 opacity-70" />}
          trend={-2.1}
          sparkData={generateSparkData(stats.inactiveMembers || 5)}
          color="#F97316"
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-3 sm:gap-4">
      <StatCard
        title="Active Members"
        value={stats.activeMembers.toLocaleString()}
        icon={<Users className="h-4 w-4" />}
        trend={4.2}
        sparkData={generateSparkData(stats.activeMembers)}
        color="#10B981"
      />
      <StatCard
        title="New Signups"
        value={stats.newSignups}
        icon={<UserPlus className="h-4 w-4" />}
        trend={12.3}
        sparkData={generateSparkData(stats.newSignups || 5)}
        color="#10B981"
      />
      <StatCard
        title="Churn Rate"
        value={`${stats.churnRate.toFixed(1)}%`}
        icon={<TrendingDown className="h-4 w-4" />}
        trend={-0.8}
        sparkData={generateSparkData(Math.max(1, stats.churnRate * 10))}
        color="#F59E0B"
      />
      <StatCard
        title="MRR"
        value={`₹${stats.mrr >= 1000 ? (stats.mrr / 1000).toFixed(1) + "K" : stats.mrr.toLocaleString()}`}
        icon={<IndianRupee className="h-4 w-4" />}
        trend={6.1}
        sparkData={generateSparkData(stats.mrr || 1000)}
        color="#3B82F6"
      />
      {/* <StatCard
        title="Attendance Today"
        value={stats.attendanceToday}
        icon={<CalendarCheck className="h-4 w-4" />}
        trend={-3.5}
        sparkData={generateSparkData(stats.attendanceToday || 50)}
        color="#EC4899"
      /> */}
      <StatCard
        title="Inactive (>10 days)"
        value={stats.inactiveMembers}
        icon={<Users className="h-4 w-4 opacity-70" />}
        trend={-2.1}
        sparkData={generateSparkData(stats.inactiveMembers || 5)}
        color="#F97316"
      />
      <StatCard
        title="Today's Collection"
        value={`₹${stats.todayCollection.toLocaleString()}`}
        icon={<IndianRupee className="h-4 w-4" />}
        sparkData={generateSparkData(stats.todayCollection || 1000)}
        color="#B6916D"
      />
    </div>
  );
}
