"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Calendar, AlertCircle, CheckCircle2, ArchiveX } from "lucide-react";
import { Installment } from "@/types";

interface InstallmentManagerProps {
  installments: Installment[];
  onChange: (installments: Installment[]) => void;
  payableAmount: number;  // Total derived from Standard Fee - Discount
  paidAmount: number;     // Amount paid directly today / upfront
  readOnly?: boolean;
  highlightId?: string;
  highlightLabel?: string;
}

export default function InstallmentManager({
  installments,
  onChange,
  payableAmount,
  paidAmount,
  readOnly = false,
  highlightId,
  highlightLabel = "Paying Today",
}: InstallmentManagerProps) {
  const sumInstallments = installments.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const totalCovered = paidAmount + sumInstallments;
  const remaining = payableAmount - totalCovered;

  const handleAddInstallment = () => {
    const newInstallment: Installment = {
      id: `inst-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      amount: remaining > 0 ? remaining : 0,
      dueDate: new Date().toISOString().split("T")[0],
      status: "pending",
    };
    onChange([...installments, newInstallment]);
  };

  const handleUpdateInstallment = (id: string, field: keyof Installment, value: any) => {
    const updated = installments.map((inst) =>
      inst.id === id ? { ...inst, [field]: value } : inst
    );
    onChange(updated);
  };

  const handleRemoveInstallment = (id: string) => {
    onChange(installments.filter((inst) => inst.id !== id));
  };

  return (
    <div className="space-y-3 bg-[#131313] border border-white/[0.08] p-4 rounded-md">
      <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
        <div>
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#B6916D]" />
            Fee Installments
          </h3>
          <p className="text-xs text-[#8888A0] mt-0.5">Split remaining balance into separate payments</p>
        </div>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddInstallment}
            className="h-8 text-xs bg-white/[0.02] border-white/[0.08] hover:bg-white/[0.04] text-[#B6916D]"
          >
            <Plus className="h-3.5 w-3.5 mr-1" /> Add
          </Button>
        )}
      </div>

      {installments.length > 0 && (
        <div className="space-y-3 pt-1">
          {installments.map((inst, index) => {
            const isPaid = inst.status === "paid";
            const isArchived = inst.status === "archived";
            const isHighlighted = highlightId === inst.id;
            return (
              <div key={inst.id} className={`grid grid-cols-12 gap-2 items-center p-2 rounded border ${
                isHighlighted 
                  ? "bg-[#B6916D]/10 border-[#B6916D]/50 relative overflow-hidden ring-1 ring-[#B6916D]/50" 
                  : isArchived
                  ? "bg-[#1A1A2E] border-white/[0.04] opacity-50 grayscale"
                  : "bg-[#0F0F1A] border-white/[0.04]"
              }`}>
                {isHighlighted && (
                  <div className="absolute top-0 right-0 bg-[#B6916D] text-white text-[8px] font-bold px-1.5 py-0.5 rounded-bl shadow-sm">
                    {highlightLabel}
                  </div>
                )}
                <div className="col-span-1 flex justify-center">
                  <span className="text-[10px] font-bold text-[#8888A0] bg-white/[0.05] w-5 h-5 rounded-full flex items-center justify-center">
                    {index + 1}
                  </span>
                </div>
                <div className="col-span-5 space-y-1">
                  <Label className="text-[10px] text-[#8888A0]">Due Date</Label>
                  <Input
                    type="date"
                    value={inst.dueDate}
                    disabled={isPaid || isArchived || readOnly}
                    onChange={(e) => handleUpdateInstallment(inst.id, "dueDate", e.target.value)}
                    className="h-8 text-xs bg-white/[0.02] border-white/[0.08] text-white"
                  />
                </div>
                <div className="col-span-5 space-y-1">
                  <Label className="text-[10px] text-[#8888A0]">Amount (₹)</Label>
                  <Input
                    type="number"
                    value={inst.amount || ""}
                    disabled={isPaid || isArchived || readOnly}
                    onChange={(e) => handleUpdateInstallment(inst.id, "amount", Number(e.target.value))}
                    className="h-8 text-xs bg-white/[0.02] border-white/[0.08] text-white"
                  />
                </div>
                <div className="col-span-1 pt-4 flex justify-end">
                  {isPaid ? (
                    <div className="text-emerald-400 p-1" title={`Paid on ${inst.paidDate || "Unknown date"}`}>
                      <CheckCircle2 className="h-4 w-4" />
                    </div>
                  ) : isArchived ? (
                    <div className="text-amber-500 p-1" title="Archived">
                      <ArchiveX className="h-4 w-4" />
                    </div>
                  ) : !readOnly ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveInstallment(inst.id)}
                      className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Validation Summary */}
      <div className="pt-2 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs gap-2">
        <div className="space-y-0.5">
          <div className="text-[#8888A0]">
            Total Payable: <span className="text-white font-medium">₹{payableAmount}</span>
            <span className="mx-2">•</span>
            Paid Today/Upfront: <span className="text-white font-medium">₹{paidAmount}</span>
          </div>
          {installments.length > 0 && (
            <div className="text-[#8888A0]">
              Installments Total: <span className="text-white font-medium">₹{sumInstallments}</span>
            </div>
          )}
        </div>
        
        {installments.length > 0 && (
          <div className={`px-2.5 py-1 rounded font-medium flex items-center gap-1.5 ${
            remaining === 0 
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {remaining === 0 ? (
              <><CheckCircle2 className="h-3.5 w-3.5" /> Balanced</>
            ) : remaining > 0 ? (
              <><AlertCircle className="h-3.5 w-3.5" /> Short by ₹{remaining}</>
            ) : (
              <><AlertCircle className="h-3.5 w-3.5" /> Over by ₹{Math.abs(remaining)}</>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
