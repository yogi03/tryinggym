import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface AnalyticsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive: boolean;
  };
  className?: string;
}

export function AnalyticsCard({ title, value, icon, trend, className }: AnalyticsCardProps) {
  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm p-4 sm:p-5 flex flex-col gap-3 group hover:border-white/[0.12] transition-all duration-300 shadow-sm",
      className
    )}>
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm text-[#8888A0] font-medium tracking-wide">{title}</span>
        <div className="p-1.5 rounded-lg bg-white/[0.04] text-primary">
          {icon}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-2xl sm:text-3xl font-bold tracking-tight">{value}</span>
        {trend && (
          <div className="flex items-center gap-1.5 mt-1">
            <span className={cn(
              "text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded-md w-fit",
              trend.isPositive ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
            )}>
              {trend.isPositive ? "↑" : "↓"} {trend.value}%
            </span>
            <span className="text-[10px] sm:text-xs text-[#8888A0]">{trend.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}
