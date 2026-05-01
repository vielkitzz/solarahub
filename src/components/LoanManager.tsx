import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Banknote, Landmark, HandCoins, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  club: any;
  canEdit: boolean;
  onChange: () => void;
}

interface Loan {
  id: string;
  club_id: string;
  valor_total: number;
  valor_parcela: number;
  installments_total: number;
  installments_paid: number;
  juros_pct: number;
  status: string;
  created_at: string;
}

const PACOTES = [
  {
    key: "small",
    valor: 5_000_000,
    juros: 10,
    parcelas: 3,
    icon: HandCoins,
    label: "Empréstimo Básico",
    desc: "Liquidez rápida para ajustes pontuais.",
  },
  {
    key: "mid",
    valor: 15_000_000,
    juros: 20,
    parcelas: 5,
    icon: Banknote,
    label: "Empréstimo Padrão",
    desc: "Investimento de médio porte para reforços.",
  },
  {
    key: "big",
    valor: 50_000_000,
    juros: 35,
    parcelas: 10,
    icon: Landmark,
    label: "Empréstimo Premium",
    desc: "Captação massiva para grandes projetos.",
  },
] as const;

const calcParcela = (valor: number, juros: number, parcelas: number) =>
  Math.round((valor * (1 + juros / 100)) / parcelas);

export const LoanManager = ({ club, canEdit, onChange }: Props) => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("loans" as any)
      .select("*")
      .eq("club_id", club.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error(error.message);
    } else {
      setLoans((data as any) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [club.id]);

  const ativos = loans.filter((l) => l.status === "active");
  const dividaAtiva = ativos.reduce(
    (s, l) => s + l.valor_parcela * (l.installments_total - l.installments_paid),
    0,
  );

  const contratar = async (pacote: (typeof PACOTES)[number]) => {
    if (!canEdit) return;
    if (!confirm(`Contratar ${pacote.label} de ${formatCurrency(pacote.valor)} em ${pacote.parcelas}x de ${formatCurrency(calcParcela(pacote.valor, pacote.juros, pacote.parcelas))}?`)) return;

    setBusy(pacote.key);
    const parcela = calcParcela(pacote.valor, pacote.juros, pacote.parcelas);

    const { error: insErr } = await supabase.from("loans" as any).insert({
      club_id: club.id,
      valor_total: pacote.valor,
      valor_parcela: parcela,
      installments_total: pacote.parcelas,
      installments_paid: 0,
      juros_pct: pacote.juros,
      status: "active",
    });

    if (insErr) {
      setBusy(null);
      return toast.error(insErr.message);
    }

    const { error: updErr } = await supabase
      .from("clubs")
      .update({ budget: Number(club.budget) + pacote.valor })
      .eq("id", club.id);

    setBusy(null);
    if (updErr) return toast.error(updErr.message);

    toast.success(`${formatCurrency(pacote.valor)} creditados no caixa.`);
    await load();
    onChange();
  };

  const amortizar = async (loan: Loan) => {
    if (!canEdit) return;
    if (Number(club.budget) < loan.valor_parcela) {
      return toast.error(`Caixa insuficiente. Necessário ${formatCurrency(loan.valor_parcela)}.`);
    }
    if (!confirm(`Pagar parcela de ${formatCurrency(loan.valor_parcela)}?`)) return;

    setBusy(loan.id);
    const novasPagas = loan.installments_paid + 1;
    const finalizou = novasPagas >= loan.installments_total;

    const { error: updLoan } = await supabase
      .from("loans" as any)
      .update({
        installments_paid: novasPagas,
        status: finalizou ? "paid" : "active",
      })
      .eq("id", loan.id);

    if (updLoan) {
      setBusy(null);
      return toast.error(updLoan.message);
    }

    const { error: updClub } = await supabase
      .from("clubs")
      .update({ budget: Number(club.budget) - loan.valor_parcela })
      .eq("id", club.id);

    setBusy(null);
    if (updClub) return toast.error(updClub.message);

    toast.success(finalizou ? "Empréstimo quitado!" : "Parcela amortizada.");
    await load();
    onChange();
  };

  return (
    <div className="space-y-4">
      {/* Resumo */}
      <Card className="p-5 bg-gradient-card border-border/50">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Landmark className="h-6 w-6 text-primary" />
            <div>
              <h2 className="font-display font-bold text-xl">Crédito Bancário</h2>
              <p className="text-sm text-muted-foreground">
                {ativos.length} empréstimo(s) ativo(s) · Dívida pendente:{" "}
                <span className="text-destructive font-semibold">{formatCurrency(dividaAtiva)}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Caixa:</span>
            <span className="font-display font-bold gold-text">{formatCurrency(Number(club.budget))}</span>
          </div>
        </div>
      </Card>

      {/* Lista de empréstimos */}
      <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
        <h3 className="font-display font-bold flex items-center gap-2">
          <Banknote className="h-4 w-4 text-primary" /> Empréstimos
        </h3>

        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : loans.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum empréstimo registrado.</p>
        ) : (
          <div className="space-y-3">
            {loans.map((l) => {
              const pct = (l.installments_paid / l.installments_total) * 100;
              const restante = l.installments_total - l.installments_paid;
              const finalizado = l.status === "paid";
              return (
                <div
                  key={l.id}
                  className={cn(
                    "p-4 rounded-xl border space-y-3",
                    finalizado
                      ? "border-success/30 bg-success/5"
                      : "border-border/40 bg-secondary/20",
                  )}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      {finalizado ? (
                        <CheckCircle2 className="h-4 w-4 text-success" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-primary" />
                      )}
                      <span className="font-display font-bold">
                        {formatCurrency(l.valor_total)}
                      </span>
                      <Badge variant="outline" className="text-[10px]">
                        {l.juros_pct}% juros
                      </Badge>
                      {finalizado && (
                        <Badge className="text-[10px] bg-success text-success-foreground">QUITADO</Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Parcela de{" "}
                      <span className="font-bold text-foreground">{formatCurrency(l.valor_parcela)}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        {l.installments_paid}/{l.installments_total} parcelas pagas
                      </span>
                      <span>{pct.toFixed(0)}%</span>
                    </div>
                    <Progress value={pct} className="h-2" />
                  </div>

                  {canEdit && !finalizado && (
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => amortizar(l)}
                        disabled={busy === l.id}
                        className="bg-gradient-gold text-primary-foreground"
                      >
                        Amortizar Parcela ({restante} restantes)
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Pacotes para contratar */}
      {canEdit && (
        <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
          <div className="border-b border-border/50 pb-3">
            <h3 className="font-display font-bold flex items-center gap-2">
              <HandCoins className="h-4 w-4 text-primary" /> Contratar novo empréstimo
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Os juros são adicionados ao valor total e divididos no número de parcelas.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            {PACOTES.map((p) => {
              const Icon = p.icon;
              const parcela = calcParcela(p.valor, p.juros, p.parcelas);
              return (
                <div
                  key={p.key}
                  className="p-4 rounded-xl border border-border/40 bg-secondary/20 flex flex-col gap-3"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-primary" />
                    <span className="font-display font-bold text-sm">{p.label}</span>
                  </div>
                  <div>
                    <p className="text-2xl font-display font-bold gold-text">
                      {formatCurrency(p.valor)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{p.desc}</p>
                  </div>
                  <div className="text-[11px] space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Juros</span>
                      <span className="font-bold">{p.juros}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Parcelas</span>
                      <span className="font-bold">
                        {p.parcelas}x de {formatCurrency(parcela)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total a pagar</span>
                      <span className="font-bold text-destructive">
                        {formatCurrency(parcela * p.parcelas)}
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => contratar(p)}
                    disabled={busy === p.key}
                    className="w-full bg-gradient-gold text-primary-foreground font-bold"
                  >
                    Contratar
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
};
