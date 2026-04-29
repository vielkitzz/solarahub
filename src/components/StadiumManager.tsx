import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Building2, Star, ArrowUpCircle, Check, X, Trophy } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  club: any;
  canEdit: boolean;
  onChange: () => void;
}

const NIVEL_LABELS = ["—", "Modesto", "Regional", "Profissional", "Premium", "Elite"];
const CUSTO_POR_LUGAR = 1500; // Custo de €1.500 por novo assento
const TABELA_CUSTOS_NIVEL: Record<number, number> = {
  2: 1000000, // 1 -> 2: €1M
  3: 10000000, // 2 -> 3: €10M
  4: 50000000, // 3 -> 4: €50M
  5: 70000000, // 4 -> 5: €70M
};

export const StadiumManager = ({ club, canEdit, onChange }: Props) => {
  const capMax = 85000;
  const maxAssentosAdicionais = Math.max(0, capMax - (club.stadium_capacity || 0));

  // RESTAURE ESTA LINHA:
  const [novoNivel, setNovoNivel] = useState<number>(club.nivel_estadio || 1);

  // States para os inputs (usando string para permitir apagar tudo ao digitar)
  const [assentosAdicionaisStr, setAssentosAdicionaisStr] = useState<string>("");
  const [precoNacStr, setPrecoNacStr] = useState<string>(String(club.preco_ingresso_nacional || 15));
  const [precoIntStr, setPrecoIntStr] = useState<string>(String(club.preco_ingresso_internacional || 25));

  const [saving, setSaving] = useState(false);
  const jogos = Number(club.jogos_por_temporada || 38);

  const qtdAssentos = parseInt(assentosAdicionaisStr) || 0;
  const capacidadeFinal = (club.stadium_capacity || 0) + Math.max(0, qtdAssentos);

  const precoNac = parseFloat(precoNacStr) || 0;
  const precoInt = parseFloat(precoIntStr) || 0;

  const custoUpgrade = useMemo(() => {
    let total = 0;
    // Soma custos de níveis
    if (novoNivel > club.nivel_estadio) {
      for (let i = (club.nivel_estadio || 1) + 1; i <= novoNivel; i++) {
        total += TABELA_CUSTOS_NIVEL[i] || 0;
      }
    }
    // Soma custo de novos lugares
    total += Math.max(0, qtdAssentos) * CUSTO_POR_LUGAR;
    return total;
  }, [novoNivel, qtdAssentos, club.nivel_estadio]);

  const ocupacaoNac = Math.max(0.3, Math.min(1, 1 - ((precoNac - 5) / 25) * 0.5));
  const ocupacaoInt = Math.max(0.3, Math.min(1, 1 - ((precoInt - 10) / 40) * 0.5));
  const receitaPorJogoNac = capacidadeFinal * ocupacaoNac * precoNac;
  const receitaPorJogoInt = capacidadeFinal * ocupacaoInt * precoInt;
  const receitaAnual = ((receitaPorJogoNac + receitaPorJogoInt) / 2) * jogos;

  const salvarPrecos = async () => {
    setSaving(true);
    const pNac = Math.max(5, Math.min(30, precoNac));
    const pInt = Math.max(10, Math.min(50, precoInt));

    const { error } = await supabase
      .from("clubs")
      .update({
        preco_ingresso_nacional: pNac,
        preco_ingresso_internacional: pInt,
      })
      .eq("id", club.id);

    setSaving(false);
    if (error) return toast.error(error.message);
    setPrecoNacStr(String(pNac));
    setPrecoIntStr(String(pInt));
    toast.success("Preços de ingressos atualizados!");
    onChange();
  };

  const aplicarUpgrade = async () => {
    if (custoUpgrade <= 0) return toast.info("Nenhuma alteração selecionada.");
    if (Number(club.budget) < custoUpgrade)
      return toast.error(`Caixa insuficiente. Necessário ${formatCurrency(custoUpgrade)}`);
    if (capacidadeFinal > capMax)
      return toast.error(`A capacidade máxima permitida é de ${capMax.toLocaleString()} lugares.`);

    if (!confirm(`Confirmar investimento de ${formatCurrency(custoUpgrade)} nas obras do estádio?`)) return;

    setSaving(true);
    const { error } = await supabase
      .from("clubs")
      .update({
        budget: Number(club.budget) - custoUpgrade,
        nivel_estadio: novoNivel,
        stadium_capacity: capacidadeFinal,
      })
      .eq("id", club.id);

    setSaving(false);
    if (error) return toast.error(error.message);

    toast.success("Obras concluídas com sucesso!");
    setAssentosAdicionaisStr(""); // Reseta o input após construir
    onChange();
  };

  const requisitos = [
    { nome: "Libertadores", capMin: 20000, nivelMin: 2 },
    { nome: "Sudamericana", capMin: 10000, nivelMin: 2 },
    { nome: "Padrão FIFA", capMin: 40000, nivelMin: 4 },
  ];

  return (
    <div className="space-y-4">
      {/* Status Atual */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-display font-bold text-xl">{club.stadium_name || "Estádio"}</h2>
              <p className="text-sm text-muted-foreground">
                Nível {club.nivel_estadio || 1} ({NIVEL_LABELS[club.nivel_estadio || 1]}) ·{" "}
                {club.stadium_capacity?.toLocaleString()} lugares
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "h-5 w-5",
                  i < (club.nivel_estadio || 1) ? "text-primary fill-primary" : "text-muted-foreground/20",
                )}
              />
            ))}
          </div>
        </div>
      </Card>

      {/* Seção de Upgrade */}
      {canEdit && (
        <Card className="p-5 bg-gradient-card border-border/50 space-y-6">
          <div className="flex items-center gap-2 border-b border-border/50 pb-3">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold">Gerenciar Obras e Melhorias</h3>
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-semibold">Nível de Infraestrutura</Label>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  disabled={n < (club.nivel_estadio || 1)}
                  onClick={() => setNovoNivel(n)}
                  className={cn(
                    "flex flex-col items-center justify-center p-3 rounded-lg border transition-all",
                    novoNivel === n ? "border-primary bg-primary/10" : "border-border/50 bg-secondary/20",
                    n < (club.nivel_estadio || 1) && "opacity-40 cursor-not-allowed grayscale",
                  )}
                >
                  <span className="text-xs font-bold">Nível {n}</span>
                  <Star
                    className={cn(
                      "h-4 w-4 mt-1",
                      novoNivel >= n ? "fill-primary text-primary" : "text-muted-foreground",
                    )}
                  />
                  {n > (club.nivel_estadio || 1) && (
                    <span className="text-[9px] mt-1 text-success">+{formatCurrency(TABELA_CUSTOS_NIVEL[n])}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Novos assentos a construir</Label>
            <Input
              type="number"
              min="0"
              max={maxAssentosAdicionais}
              value={assentosAdicionaisStr}
              onChange={(e) => {
                const str = e.target.value;
                if (str === "") {
                  setAssentosAdicionaisStr("");
                  return;
                }
                const val = parseInt(str);
                if (isNaN(val) || val < 0) return;

                // Trava rigorosa: Não deixa ultrapassar o limite restante para os 85k
                if (val > maxAssentosAdicionais) {
                  setAssentosAdicionaisStr(maxAssentosAdicionais.toString());
                } else {
                  setAssentosAdicionaisStr(str);
                }
              }}
              placeholder="Ex: 5000"
              className="bg-secondary/20"
            />
            {qtdAssentos > 0 && (
              <p className="text-[11px] text-success font-medium">
                A capacidade final será de {capacidadeFinal.toLocaleString()} lugares (Máx: {capMax.toLocaleString()})
              </p>
            )}
          </div>

          <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/20">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Investimento Total</p>
              <p className="text-2xl font-display font-bold gold-text">{formatCurrency(custoUpgrade)}</p>
            </div>
            <Button
              onClick={aplicarUpgrade}
              disabled={saving || custoUpgrade <= 0}
              className="bg-gradient-gold text-primary-foreground font-bold px-8"
            >
              Iniciar Obras
            </Button>
          </div>
        </Card>
      )}

      {/* Bilheteira */}
      <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
        <h3 className="font-display font-bold">Gestão de Ingressos</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs">Preço Nacional (€5 - €30)</Label>
            <Input
              type="number"
              min="5"
              max="30"
              value={precoNacStr}
              onChange={(e) => {
                const str = e.target.value;
                if (str === "") {
                  setPrecoNacStr("");
                  return;
                }
                const val = parseFloat(str);
                if (isNaN(val) || val < 0) return;

                // Trava rigorosa no 30
                if (val > 30) {
                  setPrecoNacStr("30");
                } else {
                  setPrecoNacStr(str);
                }
              }}
              disabled={!canEdit}
            />
            <p className="text-[10px] text-muted-foreground">
              Ocupação: {(ocupacaoNac * 100).toFixed(0)}% · Receita/jogo: {formatCurrency(receitaPorJogoNac)}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Preço Internacional (€10 - €50)</Label>
            <Input
              type="number"
              min="5"
              max="50"
              value={precoIntStr}
              onChange={(e) => {
                const str = e.target.value;
                if (str === "") {
                  setPrecoIntStr("");
                  return;
                }
                const val = parseFloat(str);
                if (isNaN(val) || val < 0) return;

                // Trava rigorosa no 50
                if (val > 50) {
                  setPrecoIntStr("50");
                } else {
                  setPrecoIntStr(str);
                }
              }}
              disabled={!canEdit}
            />
            <p className="text-[10px] text-muted-foreground">
              Ocupação: {(ocupacaoInt * 100).toFixed(0)}% · Receita/jogo: {formatCurrency(receitaPorJogoInt)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-secondary/20 rounded-xl">
          <div>
            <p className="text-[10px] uppercase text-muted-foreground">Projeção Anual ({jogos} jogos)</p>
            <p className="text-xl font-display font-bold text-success">{formatCurrency(receitaAnual)}</p>
          </div>
          {canEdit && (
            <Button
              variant="outline"
              onClick={salvarPrecos}
              disabled={saving}
              className="border-primary/50 text-primary"
            >
              Salvar Preços
            </Button>
          )}
        </div>
      </Card>

      {/* Requisitos */}
      <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Trophy className="h-4 w-4 text-primary" /> Requisitos de Competição
        </h3>
        <div className="grid gap-2">
          {requisitos.map((r) => {
            const okCap = (club.stadium_capacity || 0) >= r.capMin;
            const okNivel = (club.nivel_estadio || 1) >= r.nivelMin;
            const apto = okCap && okNivel;
            return (
              <div
                key={r.nome}
                className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg border border-border/30"
              >
                <span className="text-sm font-medium">{r.nome}</span>
                <div className="flex items-center gap-4 text-[11px]">
                  <span className={cn("flex items-center gap-1", okCap ? "text-success" : "text-destructive")}>
                    {okCap ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {r.capMin.toLocaleString()} lug.
                  </span>
                  <span className={cn("flex items-center gap-1", okNivel ? "text-success" : "text-destructive")}>
                    {okNivel ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />} {r.nivelMin}★
                  </span>
                  <Badge variant={apto ? "default" : "destructive"} className="text-[9px] uppercase">
                    {apto ? "Apto" : "Inapto"}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
