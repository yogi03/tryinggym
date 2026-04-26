import { Lightbulb, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInsight {
  id: string;
  type: "warning" | "success" | "info" | "action";
  message: string;
  title: string;
}

interface AIInsightsProps {
  insights: AIInsight[];
}

export function AIInsights({ insights }: AIInsightsProps) {
  const getIcon = (type: string) => {
    switch (type) {
      case "warning": return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case "success": return <TrendingUp className="h-5 w-5 text-green-500" />;
      case "action": return <Users className="h-5 w-5 text-blue-500" />;
      default: return <Lightbulb className="h-5 w-5 text-primary" />;
    }
  };

  const getBgClass = (type: string) => {
    switch (type) {
      case "warning": return "bg-amber-500/5 border-amber-500/20 text-amber-200";
      case "success": return "bg-emerald-500/5 border-emerald-500/20 text-emerald-200";
      case "action": return "bg-violet-500/5 border-violet-500/20 text-violet-200";
      default: return "bg-cyan-500/5 border-cyan-500/20 text-cyan-200";
    }
  };

  return (
    <div className="p-6 rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-6">
        <Lightbulb className="h-5 w-5 text-yellow-400" />
        <h3 className="text-lg font-semibold">Smart Insights</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {insights.length > 0 ? insights.map((insight) => (
          <div 
            key={insight.id} 
            className={cn("p-4 rounded-lg border flex flex-col gap-2 transition-all hover:scale-[1.02]", getBgClass(insight.type))}
          >
            <div className="flex items-center gap-2">
              {getIcon(insight.type)}
              <h4 className="font-semibold text-sm">{insight.title}</h4>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {insight.message}
            </p>
          </div>
        )) : (
          <div className="col-span-full p-4 rounded-lg bg-black/20 border border-white/5 text-center">
            <p className="text-sm text-muted-foreground">Gathering enough data to provide intelligent insights...</p>
          </div>
        )}
      </div>
    </div>
  );
}
