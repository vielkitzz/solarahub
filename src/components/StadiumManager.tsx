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
  const [novoNivel, setNovoNivel] = useState<number>(club.nivel_estadio || 1);
  const [novosAssentosStr, setNovosAssentosStr] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const capMax = 85000;
  const capacidadeAtual = club.stadium_capacity || 0;
  const novosAssentos = parseInt(novosAssentosStr) || 0;
  const novaCapacidadeFinal = capacidadeAtual + novosAssentos;

  const custoUpgrade = useMemo(() => {
    let total = 0;

    // 1. Custo da subida de nível
    if (novoNivel > club.nivel_estadio) {
      for (let i = (club.nivel_estadio || 1) + 1; i <= novoNivel; i++) {
        total += TABELA_CUSTOS_NIVEL[i] || 0;
      }
    }

    // 2. Custo dos novos assentos adicionados
    total += novosAssentos * CUSTO_POR_LUGAR;

    return total;
  }, [novoNivel, novosAssentos, club.nivel_estadio]);

  const aplicarUpgrade = async () => {
    if (custoUpgrade > (club.balance || 0)) {
      return toast.error("Saldo insuficiente para realizar estas obras.");
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from("clubs")
        .update({
          nivel_estadio: novoNivel,
          stadium_capacity: novaCapacidadeFinal,
          balance: (club.balance || 0) - custoUpgrade,
        } as any) // Adicionado 'as any' para ignorar a validação estrita do esquema
        .eq("id", club.id);

      if (error) throw error;

      toast.success("Obras concluídas com sucesso!");
      setNovosAssentosStr(""); // Limpa o input após o sucesso
      onChange();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const requisitos = [
    { nome: "Série D", capMin: 5000, nivelMin: 1 },
    { nome: "Série C", capMin: 10000, nivelMin: 2 },
    { nome: "Série B", capMin: 15000, nivelMin: 3 },
    { nome: "Série A", capMin: 20000, nivelMin: 4 },
    { nome: "Libertadores", capMin: 30000, nivelMin: 5 },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 bg-secondary/10 border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Building2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Capacidade Atual</p>
              <h3 className="text-xl font-bold font-display">
                {capacidadeAtual.toLocaleString()}{" "}
                <span className="text-sm font-normal text-muted-foreground">lugares</span>
              </h3>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-secondary/10 border-border/50">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">Nível da Infraestrutura</p>
              <h3 className="text-xl font-bold font-display">
                {club.nivel_estadio}★{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  ({NIVEL_LABELS[club.nivel_estadio || 1]})
                </span>
              </h3>
            </div>
          </div>
        </Card>
      </div>

      {canEdit && (
        <Card className="p-6 border-primary/20 bg-gradient-to-b from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-6">
            <ArrowUpCircle className="h-5 w-5 text-primary" />
            <h3 className="font-display font-bold">Departamento de Obras</h3>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">
                  Construir Novos Assentos (Máx: {capMax.toLocaleString()})
                </Label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={novosAssentosStr}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      setNovosAssentosStr("");
                      return;
                    }
                    const num = parseInt(val, 10);
                    // Validação: não negativo e não ultrapassa capMax
                    if (num >= 0 && capacidadeAtual + num <= capMax) {
                      setNovosAssentosStr(val);
                    }
                  }}
                  className="bg-secondary/20"
                />
                {novosAssentos > 0 && (
                  <p className="text-[11px] text-success font-medium">
                    Nova capacidade total: {novaCapacidadeFinal.toLocaleString()} lugares.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Melhorar Categoria (Nível)</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Button
                      key={n}
                      variant={novoNivel === n ? "default" : "outline"}
                      size="sm"
                      className="flex-1"
                      onClick={() => setNovoNivel(n)}
                      disabled={n < (club.nivel_estadio || 1)}
                    >
                      {n}★
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-secondary/30 rounded-xl p-4 flex flex-col justify-between border border-border/50">
              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Custo Total do Projeto</p>
                <h2
                  className={cn(
                    "text-2xl font-bold font-display",
                    custoUpgrade > (club.balance || 0) ? "text-destructive" : "text-primary",
                  )}
                >
                  {formatCurrency(custoUpgrade)}
                </h2>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Saldo disponível: {formatCurrency(club.balance || 0)}
                </p>
              </div>

              <Button
                className="w-full mt-4"
                disabled={
                  loading ||
                  (novoNivel === club.nivel_estadio && novosAssentos === 0) ||
                  custoUpgrade > (club.balance || 0)
                }
                onClick={aplicarUpgrade}
              >
                {loading ? "Processando Obras..." : "Confirmar Investimento"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        <h3 className="text-sm font-bold flex items-center gap-2">
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
      </div>
    </div>
  );
};
