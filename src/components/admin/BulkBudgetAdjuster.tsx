import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/format";
import { Wallet, Zap } from "lucide-react";
import { toast } from "sonner";

interface Props {
  clubs: any[];
  onDone: () => void;
}

export const BulkBudgetAdjuster = ({ clubs, onDone }: Props) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [delta, setDelta] = useState<string>("");
  const [running, setRunning] = useState(false);

  const allSelected = clubs.length > 0 && selected.size === clubs.length;
  const totalSel = useMemo(() => selected.size, [selected]);
  const deltaNum = parseFloat(delta) || 0;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(clubs.map((c) => c.id)));
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const apply = async () => {
    if (totalSel === 0) return toast.error("Selecione ao menos 1 clube");
    if (!deltaNum) return toast.error("Informe o valor (positivo p/ bônus, negativo p/ taxa)");
    if (!confirm(`Aplicar ${deltaNum >= 0 ? "+" : ""}${formatCurrency(deltaNum)} em ${totalSel} clube(s)?`)) return;
    setRunning(true);
    const { data, error } = await supabase.rpc("ajustar_caixa_clubes", {
      _club_ids: Array.from(selected),
      _delta: deltaNum,
    });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success(`${data ?? 0} clubes atualizados`);
    setSelected(new Set());
    setDelta("");
    onDone();
  };

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary" /> Ajuste de caixa em massa
        </h3>
        <div className="text-xs text-muted-foreground">{totalSel} de {clubs.length} selecionados</div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <Label className="text-xs">Valor (€) — use negativo para taxa</Label>
          <Input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="ex: 1000000 ou -500000"
          />
        </div>
        <Button onClick={apply} disabled={running} className="bg-gradient-gold text-primary-foreground">
          <Zap className="h-4 w-4" /> {running ? "Aplicando..." : "Aplicar"}
        </Button>
      </div>

      <div className="border border-border/40 rounded-lg max-h-72 overflow-y-auto">
        <div className="sticky top-0 bg-secondary/60 backdrop-blur p-2 border-b border-border/40 flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
          <span className="text-xs font-bold">Selecionar todos</span>
        </div>
        <div className="divide-y divide-border/30">
          {clubs.map((c) => (
            <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-secondary/30 cursor-pointer">
              <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                <div className="text-[10px] text-muted-foreground capitalize">{c.reputacao || "—"}</div>
              </div>
              <div className="text-xs tabular-nums text-primary">{formatCurrency(Number(c.budget))}</div>
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
};
