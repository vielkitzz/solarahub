import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, CalendarPlus, Sparkles, Download } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onChanged?: () => void;
}

export const PlayerBulkActions = ({ onChanged }: Props) => {
  const [clubs, setClubs] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [all, setAll] = useState(true);
  const [loadingAge, setLoadingAge] = useState(false);
  const [loadingPot, setLoadingPot] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    supabase
      .from("clubs")
      .select("id, name")
      .order("name")
      .then(({ data }) => setClubs(data || []));
  }, []);

  const ageAll = async () => {
    if (!confirm("Aumentar a idade de TODOS os jogadores em +1 ano? Esta ação é irreversível.")) return;
    setLoadingAge(true);
    const { data, error } = await supabase.rpc("envelhecer_todos_jogadores");
    setLoadingAge(false);
    if (error) return toast.error(error.message);
    toast.success(`${data} jogadores envelheceram +1 ano`);
    onChanged?.();
  };

  const generatePot = async () => {
    if (!confirm("Gerar potencial (modelo conservador) para todos os jogadores? Sobrescreve os atuais.")) return;
    setLoadingPot(true);
    const { data, error } = await supabase.rpc("gerar_potenciais_em_massa");
    setLoadingPot(false);
    if (error) return toast.error(error.message);
    toast.success(`Potencial gerado para ${data} jogadores`);
    onChanged?.();
  };

  const exportSquads = async () => {
    setExporting(true);
    try {
      const ids = all
        ? clubs.map((c) => c.id)
        : Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
      if (ids.length === 0) {
        toast.error("Selecione ao menos um clube ou marque 'Todos'");
        return;
      }
      const { data: players, error } = await supabase
        .from("players")
        .select("*, clubs(id, name)")
        .in("club_id", ids);
      if (error) throw error;

      // Agrupa por clube
      const grouped: Record<string, any> = {};
      (players || []).forEach((p: any) => {
        const cName = p.clubs?.name || "Sem clube";
        if (!grouped[cName]) grouped[cName] = { club: cName, players: [] };
        grouped[cName].players.push({
          name: p.name,
          age: p.age,
          position: p.position,
          nationality: p.nationality,
          habilidade: p.habilidade,
          potential_min: p.potential_min,
          potential_max: p.potential_max,
          salario_atual: p.salario_atual,
          market_value: p.market_value,
          contrato_ate: p.contrato_ate,
        });
      });

      const payload = {
        exported_at: new Date().toISOString(),
        clubs: Object.values(grouped),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `elenco-${all ? "todos" : ids.length + "-clubes"}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Exportação concluída!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card className="p-5 border-border/50 bg-gradient-card space-y-4">
      <h3 className="font-display font-bold flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> Ações em massa
      </h3>

      <div className="grid sm:grid-cols-2 gap-3">
        <Button
          onClick={ageAll}
          disabled={loadingAge}
          variant="outline"
          className="justify-start"
        >
          {loadingAge ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Idade +1 (todos)
        </Button>
        <Button
          onClick={generatePot}
          disabled={loadingPot}
          variant="outline"
          className="justify-start"
        >
          {loadingPot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Gerar potenciais
        </Button>
      </div>

      <div className="border-t border-border/50 pt-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Exportar elenco (JSON)</Label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <Checkbox checked={all} onCheckedChange={(v) => setAll(!!v)} />
            Todos os clubes
          </label>
        </div>

        {!all && (
          <div className="max-h-40 overflow-y-auto space-y-1 border border-border/50 rounded-lg p-2 scrollbar-thin">
            {clubs.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/40 rounded px-2 py-1">
                <Checkbox
                  checked={!!selected[c.id]}
                  onCheckedChange={(v) => setSelected((s) => ({ ...s, [c.id]: !!v }))}
                />
                {c.name}
              </label>
            ))}
          </div>
        )}

        <Button
          onClick={exportSquads}
          disabled={exporting}
          className="w-full bg-gradient-gold text-primary-foreground"
        >
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Baixar JSON
        </Button>
      </div>
    </Card>
  );
};
