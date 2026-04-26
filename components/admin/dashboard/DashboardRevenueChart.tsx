"use client";

import { useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

interface RevenueDataPoint {
  month: string;
  revenue: number;
}

interface DashboardRevenueChartProps {
  data: RevenueDataPoint[];
  multiYearData?: RevenueDataPoint[];
  title?: string;
  subtitle?: string;
  showControls?: boolean;
  externalPeriod?: "Monthly" | "Quarterly" | "Yearly";
}

export default function DashboardRevenueChart({ 
  data, 
  multiYearData,
  title = "Revenue Trend",
  subtitle = "12-month revenue analysis",
  showControls = true,
  externalPeriod
}: DashboardRevenueChartProps) {
  const [internalPeriod, setInternalPeriod] = useState<"Monthly" | "Quarterly" | "Yearly">("Monthly");
  const period = externalPeriod || internalPeriod;

  const aggregatedData = (() => {
    if (period === "Monthly") return data;
    
    if (period === "Quarterly") {
      const q: RevenueDataPoint[] = [];
      const labels = ["Q1", "Q2", "Q3", "Q4"];
      for (let i = 0; i < 4; i++) {
        const slice = data.slice(i * 3, (i + 1) * 3);
        const revenue = slice.reduce((s, d) => s + (d.revenue || 0), 0);
        q.push({ month: labels[i], revenue });
      }
      return q;
    }

    if (period === "Yearly") {
      if (multiYearData && multiYearData.length > 0) {
        return multiYearData;
      }
      return [{ month: "Year", revenue: data.reduce((s, d) => s + (d.revenue || 0), 0) }];
    }

    return data;
  })();

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h3 className="text-base sm:text-lg font-semibold font-outfit tracking-wide">{title}</h3>
          <p className="text-xs text-[#8888A0]">{subtitle}</p>
        </div>
        {showControls && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-[#8888A0] cursor-pointer">
              <input type="checkbox" className="rounded border-white/20 bg-transparent w-3.5 h-3.5 accent-emerald-500" />
              Compare YoY
            </label>
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden ml-2">
              {(["Monthly", "Quarterly", "Yearly"] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setInternalPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? "bg-emerald-600 text-white" : "text-[#8888A0] hover:text-white hover:bg-white/[0.04]"}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="h-[250px] sm:h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={aggregatedData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="dashRevGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.35} />
                <stop offset="50%" stopColor="#06B6D4" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
            <XAxis dataKey="month" stroke="#555" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#555" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `₹${v >= 1000 ? (v/1000).toFixed(0) + "k" : v}`} />
            <Tooltip
              contentStyle={{ backgroundColor: "#1E1E3A", border: "1px solid #ffffff15", borderRadius: "10px", color: "#fff", fontSize: "12px" }}
              formatter={(value: any) => [`₹${value.toLocaleString()}`, "Revenue"]}
              labelStyle={{ color: "#8888A0" }}
            />
            <Area type="monotone" dataKey="revenue" stroke="#8B5CF6" strokeWidth={2.5} fillOpacity={1} fill="url(#dashRevGrad)" dot={{ r: 3, fill: "#8B5CF6", stroke: "#1A1A2E", strokeWidth: 2 }} activeDot={{ r: 5, fill: "#A78BFA" }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
