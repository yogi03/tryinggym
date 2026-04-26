"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Users, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export interface SplitPayment {
  amount: number;
  receivedBy: string;
  paymentMode?: string;
}

interface PaymentSplitterProps {
  recipients: string[];
  initialTotal?: number;
  initialSplits?: SplitPayment[];
  onChange: (splits: SplitPayment[]) => void;
}

export default function PaymentSplitter({ recipients, initialTotal = 0, initialSplits, onChange }: PaymentSplitterProps) {
  const [splits, setSplits] = useState<SplitPayment[]>([]);

  // Initialize with initialSplits if provided, otherwise one empty split
  useEffect(() => {
    if (initialSplits && initialSplits.length > 0) {
      setSplits(initialSplits);
    } else if (splits.length === 0) {
      setSplits([{ amount: initialTotal, receivedBy: "", paymentMode: "cash" }]);
    }
  }, [initialTotal, initialSplits]);

  const addSplit = () => {
    const newSplits = [...splits, { amount: 0, receivedBy: "", paymentMode: "cash" }];
    setSplits(newSplits);
    onChange(newSplits);
  };

  const removeSplit = (index: number) => {
    if (splits.length <= 1) return;
    const newSplits = splits.filter((_, i) => i !== index);
    setSplits(newSplits);
    onChange(newSplits);
  };

  const updateSplit = (index: number, field: keyof SplitPayment, value: any) => {
    const newSplits = [...splits];
    newSplits[index] = { ...newSplits[index], [field]: value };
    setSplits(newSplits);
    onChange(newSplits);
  };


  const totalSplits = splits.reduce((sum, split) => sum + (Number(split.amount) || 0), 0);

  return (
    <div className="space-y-4 p-3 sm:p-4 rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center justify-between mb-2">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Users className="h-4 w-4 text-[#B6916D]" />
          Payment Split Breakdown
        </Label>
        <Button 
          type="button" 
          variant="outline" 
          size="sm" 
          onClick={addSplit}
          className="h-8 text-[10px] font-bold border-[#B6916D]/20 text-[#B6916D] hover:bg-[#B6916D]/10"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Recipient
        </Button>
      </div>

      <div className="space-y-3">
        {splits.map((split, index) => (
          <div key={index} className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
            <div className="flex-1 w-full space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">Recipient</Label>
              <Select
                value={split.receivedBy}
                onValueChange={(val) => updateSplit(index, "receivedBy", val)}
              >
                <SelectTrigger className="bg-black/20">
                  <SelectValue placeholder="Select Recipient" />
                </SelectTrigger>
                <SelectContent>
                  {recipients.map((name) => (
                    <SelectItem key={name} value={name}>{name}</SelectItem>
                  ))}
                  {recipients.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground italic">Add recipients in Settings first</div>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full sm:w-32 space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">Amount</Label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  type="number"
                  placeholder="0"
                  className="pl-8 bg-black/20"
                  value={split.amount || ""}
                  onChange={(e) => updateSplit(index, "amount", Number(e.target.value))}
                />
              </div>
            </div>

            <div className="w-full sm:w-32 space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground ml-1">Payment Mode</Label>
              <Select
                value={split.paymentMode || "cash"}
                onValueChange={(val) => updateSplit(index, "paymentMode", val)}
              >
                <SelectTrigger className="bg-black/20">
                  <SelectValue placeholder="Mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 mb-[-2px] sm:mb-0"
              onClick={() => removeSplit(index)}
              disabled={splits.length <= 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <div className="pt-2 border-t border-white/[0.06] flex justify-between items-center text-sm">
        <span className="text-muted-foreground">Total Entered:</span>
        <span className={`font-bold ${totalSplits === initialTotal ? "text-emerald-400" : "text-amber-400"}`}>
          ₹{totalSplits.toLocaleString()}
        </span>
      </div>
      {initialTotal > 0 && totalSplits !== initialTotal && (
        <p className="text-[10px] text-amber-500/80 italic text-right">
          Sum (₹{totalSplits}) does not match total amount (₹{initialTotal})
        </p>
      )}
    </div>
  );
}
