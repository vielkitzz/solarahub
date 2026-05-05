import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Coins, Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

type Params = {
  receita_base: { estadual: number; nacional: number; continental: number; mundial: number };
  bilheteria_por_nivel: number;
  manutencao_por_nivel_base: number;
  multiplicadores_evolucao: { "1": number; "2": number; "3": number; "4": number; "5": number };
  premiacao: {
    "1": number;
    "2": number;
    "3": number;
    "4": number;
    "5_8": number;
    "9_12": number;
    "13_16": number;
    "17_20": number;
  };
};

const DEFAULT: Params = {
  receita_base: { estadual: 4300000, nacional: 11500000, continental: 23000000, mundial: 45000000 },
  bilheteria_por_nivel: 500000,
  manutencao_por_nivel_base: 300000,
  multiplicadores_evolucao: { "1": 0.8, "2": 0.95, "3": 1.1, "4": 1.2, "5": 1.3 },
  premiacao: {
    "1": 8500000,
    "2": 6000000,
    "3": 4000000,
    "4": 2000000,
    "5_8": 1500000,
    "9_12": 500000,
    "13_16": 100000,
    "17_20": 0,
  },
};

export const EconomyParams = () => {
  const [p, setP] = useState<Params>(DEFAULT);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "economia_params")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) {
          // Merge profundo: garante que chaves novas do DEFAULT sejam preservadas
          const remote = data.value as any;
          setP({
            ...DEFAULT,
            ...remote,
            receita_base: { ...DEFAULT.receita_base, ...remote.receita_base },
            multiplicadores_evolucao: { ...DEFAULT.multiplicadores_evolucao, ...remote.multiplicadores_evolucao },
            premiacao: { ...DEFAULT.premiacao, ...remote.premiacao },
          });
        }
        setLoaded(true);
      });
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "economia_params", value: p as any }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Parâmetros econômicos atualizados! Serão aplicados na próxima virada.");
  };

  const num = (v: any) => (v === "" || v === null ? 0 : Number(v));

  if (!loaded) return <div className="text-muted-foreground text-sm p-4">Carregando parâmetros...</div>;

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold flex items-center gap-2">
            <Coins className="h-5 w-5 text-primary" /> Parâmetros econômicos
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Aplicados automaticamente na virada de temporada.</p>
        </div>
        <Button onClick={save} disabled={saving} className="bg-gradient-gold text-primary-foreground">
          <Save className="h-4 w-4 mr-1" /> {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      {/* Receita base */}
      <section className="space-y-2">
        <h4 className="text-sm font-bold text-foreground">Receita de TV por reputação (€/ano)</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(["estadual", "nacional", "continental", "mundial"] as const).map((k) => (
            <div key={k}>
              <Label className="capitalize text-xs">{k}</Label>
              <Input
                type="number"
                value={p.receita_base[k]}
                onChange={(e) => setP({ ...p, receita_base: { ...p.receita_base, [k]: num(e.target.value) } })}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(p.receita_base[k])}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Bilheteria e manutenção */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Bilheteria base por nível de estádio (€)</Label>
          <Input
            type="number"
            value={p.bilheteria_por_nivel}
            onChange={(e) => setP({ ...p, bilheteria_por_nivel: num(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(p.bilheteria_por_nivel)}</p>
        </div>
        <div>
          <Label className="text-xs">Custo de manutenção por nível de base (€)</Label>
          <Input
            type="number"
            value={p.manutencao_por_nivel_base}
            onChange={(e) => setP({ ...p, manutencao_por_nivel_base: num(e.target.value) })}
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(p.manutencao_por_nivel_base)}</p>
        </div>
      </section>

      {/* Multiplicadores evolução */}
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
                onChange={(e) =>
                  setP({ ...p, multiplicadores_evolucao: { ...p.multiplicadores_evolucao, [k]: num(e.target.value) } })
                }
              />
            </div>
          ))}
        </div>
      </section>

      {/* Premiação por posição — agora conectada à função do banco */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-bold text-foreground">Premiação por posição final — Superliga (€)</h4>
          <span
            title="Estes valores alimentam diretamente a função premiacao_por_posicao() usada na virada de temporada."
            className="text-muted-foreground cursor-help"
          >
            <Info className="h-3.5 w-3.5" />
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              ["1", "🥇 1º lugar"],
              ["2", "🥈 2º lugar"],
              ["3", "🥉 3º lugar"],
              ["4", "4º lugar"],
              ["5_8", "5º – 8º"],
              ["9_12", "9º – 12º"],
              ["13_16", "13º – 16º"],
              ["17_20", "17º – 20º"],
            ] as const
          ).map(([k, label]) => (
            <div key={k}>
              <Label className="text-xs">{label}</Label>
              <Input
                type="number"
                value={(p.premiacao as any)[k]}
                onChange={(e) => setP({ ...p, premiacao: { ...p.premiacao, [k]: num(e.target.value) } })}
              />
              <p className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency((p.premiacao as any)[k])}</p>
            </div>
          ))}
        </div>
      </section>
    </Card>
  );
};
