"use client";

import { useState, useEffect, useRef } from "react";
import { Search, User, Contact, X, Loader2, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Member, Staff } from "@/types";
import { useRouter } from "next/navigation";

interface UniversalSearchProps {
  members: Member[];
  staff: Staff[];
  includeStaff?: boolean;
}

export default function UniversalSearch({ members, staff, includeStaff = true }: UniversalSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ type: "member" | "staff"; data: any }[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const searchLower = query.toLowerCase();
    
    const memberResults = members.filter(m => 
      m.fullName.toLowerCase().includes(searchLower) ||
      m.email.toLowerCase().includes(searchLower) ||
      m.phone.toLowerCase().includes(searchLower) ||
      m.memberId.toLowerCase().includes(searchLower) ||
      (m.nickname && m.nickname.toLowerCase().includes(searchLower)) ||
      (m.address && m.address.toLowerCase().includes(searchLower)) ||
      (m.fitnessGoals && m.fitnessGoals.toLowerCase().includes(searchLower)) ||
      (m.healthAssessment && m.healthAssessment.toLowerCase().includes(searchLower))
    ).map(m => ({ type: "member" as const, data: m }));

    const staffResults = includeStaff
      ? staff.filter(s => 
          s.fullName.toLowerCase().includes(searchLower) ||
          s.email.toLowerCase().includes(searchLower) ||
          s.phone.toLowerCase().includes(searchLower) ||
          s.staffId.toLowerCase().includes(searchLower)
        ).map(s => ({ type: "staff" as const, data: s }))
      : [];

    setResults([...memberResults, ...staffResults].slice(0, 8));
    setIsOpen(true);
  }, [query, members, staff]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (result: { type: "member" | "staff"; data: any }) => {
    if (result.type === "member") {
      router.push(`/admin/member/${result.data.memberId}`);
    } else {
      router.push(`/admin/staff/${result.data.staffId}`);
    }
    setIsOpen(false);
    setQuery("");
  };

  return (
    <div className="relative w-full max-w-2xl mx-auto z-50 mb-6">
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[#8888A0] group-focus-within:text-[#6F51FF] transition-colors" />
        </div>
        <Input
          placeholder={includeStaff ? "Search members, staff, ID, or phone..." : "Search members, ID, phone, email, or nickname..."}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.trim() && setIsOpen(true)}
          className="w-full h-12 pl-12 pr-10 bg-[#1A1A2E]/80 backdrop-blur-md border-white/[0.08] text-white placeholder:text-[#55556F] rounded-2xl focus-visible:ring-2 focus-visible:ring-[#6F51FF]/50 focus-visible:border-[#6F51FF]/50 transition-all shadow-lg"
        />
        {query && (
          <button 
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-4 flex items-center text-[#8888A0] hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div 
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 mt-2 bg-[#131325] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <div className="p-2">
            {results.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleSelect(result)}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/[0.04] transition-all group border border-transparent hover:border-white/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${result.type === 'member' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'}`}>
                    {result.type === 'member' ? <User className="h-4 w-4" /> : <Contact className="h-4 w-4" />}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-white group-hover:text-[#6F51FF] transition-colors">
                      {result.data.fullName}
                      {result.data.nickname && <span className="text-[#8888A0] font-normal text-xs ml-2">({result.data.nickname})</span>}
                    </p>
                    <p className="text-[11px] text-[#8888A0] flex items-center gap-2">
                      <span className="capitalize">{result.type}</span>
                      <span className="opacity-30">•</span>
                      <span>{result.data.phone}</span>
                      <span className="opacity-30">•</span>
                      <span className="font-mono text-[10px]">#{result.type === 'member' ? result.data.memberId.slice(0,8) : result.data.staffId.slice(0,8)}</span>
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-[#8888A0] opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
          <div className="p-3 bg-white/[0.02] border-t border-white/[0.04] flex items-center justify-between">
            <p className="text-[10px] text-[#8888A0] uppercase tracking-wider font-semibold">Results for "{query}"</p>
            <p className="text-[10px] text-[#55556F]">Esc to close</p>
          </div>
        </div>
      )}

      {isOpen && query && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-[#131325] border border-white/[0.08] rounded-2xl shadow-2xl p-8 text-center animate-in fade-in slide-in-from-top-2 duration-200">
           <div className="inline-flex p-3 rounded-full bg-white/[0.02] mb-3">
             <Search className="h-6 w-6 text-[#55556F]" />
           </div>
           <p className="text-white font-medium">No results found</p>
           <p className="text-sm text-[#8888A0] mt-1">We couldn't find any matching {includeStaff ? "member or staff" : "member"} record.</p>
        </div>
      )}
    </div>
  );
}
