"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy, ChevronDown, ChevronUp, Link2, Zap } from "lucide-react";

interface RegistrationLinksProps {
  gymId: string;
}

export default function RegistrationLinks({ gymId }: RegistrationLinksProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedTrial, setCopiedTrial] = useState(false);

  const regUrl = typeof window !== "undefined" ? `${window.location.origin}/register?gym=${gymId}` : "";
  const trialUrl = typeof window !== "undefined" ? `${window.location.origin}/trial?gym=${gymId}` : "";

  const copyLink = (url: string, type: "reg" | "trial") => {
    navigator.clipboard.writeText(url);
    if (type === "reg") { setCopied(true); setTimeout(() => setCopied(false), 2000); }
    else { setCopiedTrial(true); setTimeout(() => setCopiedTrial(false), 2000); }
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#1A1A2E]/80 backdrop-blur-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 sm:px-6 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-[#8888A0]" />
          <span className="text-sm font-medium">Registration Links</span>
          <span className="text-[11px] text-[#8888A0]">• Share with new members</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-[#8888A0]" /> : <ChevronDown className="h-4 w-4 text-[#8888A0]" />}
      </button>

      {expanded && (
        <div className="px-4 sm:px-6 pb-4 space-y-3 border-t border-white/[0.04] pt-4">
          {/* Member Registration */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium min-w-[140px]">
              <Link2 className="h-3.5 w-3.5" /> Member Registration
            </div>
            <div className="flex-1 flex gap-2">
              <div className="flex-1 bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono text-[#8888A0] truncate">{regUrl}</div>
              <Button size="sm" className="shrink-0 h-8 text-xs" variant={copied ? "secondary" : "default"} onClick={() => copyLink(regUrl, "reg")}>
                {copied ? <><Check className="h-3 w-3 mr-1" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
              </Button>
            </div>
          </div>

          {/* Trial Registration */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-400 font-medium min-w-[140px]">
              <Zap className="h-3.5 w-3.5" /> Trial Pass
            </div>
            <div className="flex-1 flex gap-2">
              <div className="flex-1 bg-black/30 border border-white/[0.06] rounded-lg px-3 py-2 text-xs font-mono text-[#8888A0] truncate">{trialUrl}</div>
              <Button size="sm" className="shrink-0 h-8 text-xs" variant={copiedTrial ? "secondary" : "default"} onClick={() => copyLink(trialUrl, "trial")}>
                {copiedTrial ? <><Check className="h-3 w-3 mr-1" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
