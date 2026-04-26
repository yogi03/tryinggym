"use client";

import { useState, useEffect } from "react";
import { Search, X, User, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, limit, doc, getDoc } from "firebase/firestore";
import { Member } from "@/types";
import { useAuth } from "@/lib/auth/auth-context";

interface FamilyManagerProps {
  currentFamilyIds: string[];
  onAdd: (memberId: string) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  gymId: string;
  excludeMemberId?: string; // Current member ID to exclude from search
}

export default function FamilyManager({ 
  currentFamilyIds, 
  onAdd, 
  onRemove, 
  gymId,
  excludeMemberId 
}: FamilyManagerProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Member[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [familyMembers, setFamilyMembers] = useState<Member[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Fetch current family members data
  useEffect(() => {
    const fetchFamilyData = async () => {
      const uniqueIds = [...new Set(currentFamilyIds)];
      if (!uniqueIds.length) {
        setFamilyMembers([]);
        return;
      }
      setIsLoadingMembers(true);
      try {
        const membersData: Member[] = [];
        for (const id of uniqueIds) {
          const mDoc = await getDoc(doc(db, "gyms", gymId, "members", id));
          if (mDoc.exists()) {
            membersData.push({ memberId: mDoc.id, ...mDoc.data() } as Member);
          }
        }
        setFamilyMembers(membersData);
      } catch (err) {
        console.error("Error fetching family members:", err);
      } finally {
        setIsLoadingMembers(false);
      }
    };

    fetchFamilyData();
  }, [currentFamilyIds, gymId]);

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length < 3) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const membersRef = collection(db, "gyms", gymId, "members");
      const uniqueFamily = [...new Set(currentFamilyIds)];
      
      // Build search variants for case-insensitive matching
      const searchVariants = new Set<string>();
      searchVariants.add(val);
      searchVariants.add(val.charAt(0).toUpperCase() + val.slice(1));
      searchVariants.add(val.toLowerCase());
      searchVariants.add(val.toUpperCase());

      const allResults = new Map<string, Member>();
      
      for (const variant of searchVariants) {
        const q = query(
          membersRef, 
          where("fullName", ">=", variant),
          where("fullName", "<=", variant + "\uf8ff"),
          limit(5)
        );
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          const m = { memberId: d.id, ...d.data() } as Member;
          if (m.memberId !== excludeMemberId && !uniqueFamily.includes(m.memberId)) {
            allResults.set(m.memberId, m);
          }
        });
      }
      
      setSearchResults([...allResults.values()].slice(0, 5));
    } catch (err) {
      console.error("Error searching members:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAdd = async (mId: string) => {
    setActionInProgress(mId);
    try {
      await onAdd(mId);
      setSearchQuery("");
      setSearchResults([]);
    } finally {
      setActionInProgress(null);
    }
  };

  const handleRemove = async (mId: string) => {
    setActionInProgress(mId);
    try {
      await onRemove(mId);
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-4 bg-white/[0.02] p-4 rounded-lg border border-white/[0.08]">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-[#B6916D] uppercase tracking-widest">Family & Friends</Label>
        <span className="text-[10px] text-muted-foreground uppercase">{[...new Set(currentFamilyIds)].length} Linked</span>
      </div>

      {/* Linked Members List */}
      <div className="space-y-2">
        {isLoadingMembers ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading connections...
          </div>
        ) : familyMembers.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {familyMembers.map((m) => (
              <div 
                key={m.memberId} 
                className="flex items-center gap-3 p-2 rounded-md bg-white/[0.04] border border-white/[0.08] group"
              >
                <div className="h-8 w-8 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-4 w-4 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{m.fullName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={actionInProgress === m.memberId}
                  className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleRemove(m.memberId)}
                >
                  {actionInProgress === m.memberId ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground italic py-1">No family members linked yet.</p>
        )}
      </div>

      {/* Search & Add */}
      <div className="relative pt-2 border-t border-white/[0.08]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name to add family..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white/[0.04] border-white/[0.08] text-white focus:border-[#B6916D]/40"
          />
        </div>

        {searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1A1A2E] border border-white/[0.08] rounded-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            {searchResults.map((m) => (
              <button
                key={m.memberId}
                className="w-full flex items-center gap-3 p-2 hover:bg-white/[0.08] transition-colors text-left disabled:opacity-50"
                onClick={() => handleAdd(m.memberId)}
                disabled={actionInProgress !== null}
              >
                <div className="h-7 w-7 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center flex-shrink-0">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.fullName} className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-3 w-3 text-muted-foreground/40" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{m.fullName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{m.phone}</p>
                </div>
                <div className="text-[10px] font-bold text-[#B6916D] uppercase">Add</div>
              </button>
            ))}
          </div>
        )}
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4">
            <Loader2 className="h-3 w-3 animate-spin text-[#B6916D]" />
          </div>
        )}
      </div>
    </div>
  );
}
