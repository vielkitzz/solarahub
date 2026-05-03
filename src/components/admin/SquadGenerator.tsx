import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onGenerated?: () => void;
}

export const SquadGenerator = ({ onGenerated }: Props) => {
  const [clubs, setClubs] = useState<{ id: string; name: string }[]>([]);
  const [clubId, setClubId] = useState<string>("");
  const [qty, setQty] = useState<number>(20);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from("clubs")
      .select("id, name")
      .order("name")
      .then(({ data }) => setClubs(data || []));
  }, []);

  const generate = async () => {
    if (!clubId) return toast.error("Selecione um clube");
    if (qty < 1 || qty > 40) return toast.error("Quantidade entre 1 e 40");
    if (!confirm(`Adicionar ${qty} jogadores ao elenco do clube selecionado?`)) return;

    setLoading(true);
    const { data, error } = await supabase.rpc("gerar_elenco_para_clube" as any, {
      _club_id: clubId,
      _quantidade: qty,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success(`${data} jogadores adicionados ao elenco`);
    onGenerated?.();
  };

  return (
    <Card className="p-5 border-border/50 bg-gradient-card space-y-4">
      <h3 className="font-display font-bold flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" /> Gerar elenco aleatório
      </h3>
      <p className="text-xs text-muted-foreground -mt-2">
        Cria jogadores com idade, posição, qualidade e potencial aleatórios. Os novos jogadores são adicionados ao
        elenco existente do clube.
      </p>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2">
          <Label className="text-xs">Clube destino</Label>
          <Select value={clubId} onValueChange={setClubId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um clube..." />
            </SelectTrigger>
            <SelectContent>
              {clubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Quantidade (1–40)</Label>
          <Input
            type="number"
            min={1}
            max={40}
            value={qty}
            onChange={(e) => setQty(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>

      <Button
        onClick={generate}
        disabled={loading || !clubId}
        className="w-full bg-gradient-gold text-primary-foreground"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
        Gerar e adicionar ao elenco
      </Button>
    </Card>
  );
};
