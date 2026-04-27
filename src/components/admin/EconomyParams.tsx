import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Coins } from "lucide-react";
import { toast } from "sonner";

type Params = {
  receita_base: { estadual: number; nacional: number; continental: number; mundial: number };
  bilheteria_por_nivel: number;
  manutencao_por_nivel_base: number;
  multiplicadores_evolucao: { "1": number; "2": number; "3": number; "4": number; "5": number };
  premiacao: {
    "1": number; "2": number; "3": number; "4": number;
    "5_8": number; "9_12": number; "13_16": number; "17_20": number;
  };
};

const DEFAULT: Params = {
  receita_base: { estadual: 4300000, nacional: 11500000, continental: 23000000, mundial: 45000000 },
  bilheteria_por_nivel: 500000,
  manutencao_por_nivel_base: 300000,
  multiplicadores_evolucao: { "1": 0.8, "2": 0.95, "3": 1.1, "4": 1.2, "5": 1.3 },
  premiacao: { "1": 20000000, "2": 12000000, "3": 8000000, "4": 5000000, "5_8": 3000000, "9_12": 1500000, "13_16": 750000, "17_20": 300000 },
};

export const EconomyParams = () => {
  const [p, setP] = useState<Params>(DEFAULT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("settings").select("value").eq("key", "economia_params").maybeSingle().then(({ data }) => {
      if (data?.value) setP({ ...DEFAULT, ...(data.value as any) });
    });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("settings").update({ value: p as any }).eq("key", "economia_params");
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parâmetros econômicos atualizados!");
  };

  const num = (v: any) => (v === "" || v === null ? 0 : Number(v));

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" /> Parâmetros econômicos
        </h3>
        <Button onClick={save} disabled={saving} className="bg-gradient-gold text-primary-foreground">
          <Save className="h-4 w-4" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Valores aplicados na próxima virada de temporada e na pré-visualização.
      </p>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Receita base por reputação (€/ano)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["estadual", "nacional", "continental", "mundial"] as const).map((k) => (
            <div key={k}>
              <Label className="capitalize text-xs">{k}</Label>
              <Input
                type="number"
                value={p.receita_base[k]}
                onChange={(e) => setP({ ...p, receita_base: { ...p.receita_base, [k]: num(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bilheteria base por nível de estádio (€)</Label>
          <Input type="number" value={p.bilheteria_por_nivel} onChange={(e) => setP({ ...p, bilheteria_por_nivel: num(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">Custo de manutenção por nível de base (€)</Label>
          <Input type="number" value={p.manutencao_por_nivel_base} onChange={(e) => setP({ ...p, manutencao_por_nivel_base: num(e.target.value) })} />
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Multiplicadores de evolução por nível de base</h4>
        <div className="grid grid-cols-5 gap-2">
          {(["1", "2", "3", "4", "5"] as const).map((k) => (
            <div key={k}>
              <Label className="text-xs">Nível {k}</Label>
              <Input
                type="number"
                step="0.05"
                value={p.multiplicadores_evolucao[k]}
                onChange={(e) => setP({ ...p, multiplicadores_evolucao: { ...p.multiplicadores_evolucao, [k]: num(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Premiação por posição final (€)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {([
            ["1", "1º"], ["2", "2º"], ["3", "3º"], ["4", "4º"],
            ["5_8", "5º–8º"], ["9_12", "9º–12º"], ["13_16", "13º–16º"], ["17_20", "17º–20º"],
          ] as const).map(([k, label]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                value={(p.premiacao as any)[k]}
                onChange={(e) => setP({ ...p, premiacao: { ...p.premiacao, [k]: num(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </section>
    </Card>
  );
};
