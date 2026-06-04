import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type TransferType = "compra" | "emprestimo" | "troca";

interface Props {
  player: any | null;
  myClub: { id: string; budget: number } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSent?: () => void;
}

export const NegotiationDialog = ({ player, myClub, open, onOpenChange, onSent }: Props) => {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<TransferType>("compra");
  const [valor, setValor] = useState("0");
  const [salario, setSalario] = useState("0");
  const [luvas, setLuvas] = useState("0");
  const [anos, setAnos] = useState("3");
  const [duracao, setDuracao] = useState("1");
  const [opcaoCompra, setOpcaoCompra] = useState("0");
  const [percentualRevenda, setPercentualRevenda] = useState("0");
  const [jogadorTrocado, setJogadorTrocado] = useState<string>("");
  const [myPlayers, setMyPlayers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [temporadaAtual, setTemporadaAtual] = useState<number>(new Date().getFullYear());

  const base = Number(player?.valor_base_calculado) || Number(player?.market_value) || 0;
  const caixa = Number(myClub?.budget || 0);

  useEffect(() => {
    if (!open || !player || !myClub) return;
    setTipo("compra");
    setValor(String(Math.round(base)));
    setLuvas("0");
    setAnos("3");
    setDuracao("1");
    setOpcaoCompra("0");
    setPercentualRevenda("0");
    setJogadorTrocado("");
    (async () => {
      try {
        const { data } = await supabase.rpc("sugerir_salario_jogador", { _jogador_id: player.id });
        const sug = data ? Math.round(Number(data)) : Math.round(base * 0.1);
        setSalario(String(Math.max(50000, sug)));
      } catch {
        setSalario(String(Math.max(50000, Math.round(base * 0.1))));
      }
      const { data: mp } = await supabase
        .from("players")
        .select("id, name, position, valor_base_calculado")
        .eq("club_id", myClub.id);
      setMyPlayers(mp || []);
      const { data: cfg } = await supabase.from("settings").select("value").eq("key", "temporada_atual").maybeSingle();
      const ano = Number((cfg?.value as any)?.ano);
      if (ano) setTemporadaAtual(ano);
    })();
  }, [open, player?.id, myClub?.id]);

  const valorNum = parseFloat(valor) || 0;
  const luvasNum = parseFloat(luvas) || 0;
  const total = valorNum + luvasNum;

  const fpError = useMemo(() => {
    if (tipo !== "compra") return null;
    if (!base) return "Jogador sem valor base";
    if (valorNum < base * 0.5) return `Mínimo permitido: ${formatCurrency(base * 0.5)} (50%)`;
    if (valorNum > base * 3.0) return `Máximo permitido: ${formatCurrency(base * 3.0)} (300%)`;
    return null;
  }, [tipo, base, valorNum]);

  const caixaError = tipo !== "emprestimo" && total > caixa
    ? `Caixa insuficiente: necessário ${formatCurrency(total)}, disponível ${formatCurrency(caixa)}`
    : null;
  const trocaError = tipo === "troca" && !jogadorTrocado ? "Selecione um jogador para troca" : null;

  const submit = async () => {
    if (!player || !myClub || !user) return;
    if (typeof player.age === "number" && player.age >= 33) {
      return toast.error("Jogador próximo da aposentadoria — não aceita propostas");
    }
    if (fpError) return toast.error(fpError);
    if (caixaError) return toast.error(caixaError);
    if (trocaError) return toast.error(trocaError);
    if (!salario || parseFloat(salario) < 0) return toast.error("Salário inválido");
    const a = parseInt(anos) || 1;
    if (a < 1 || a > 5) return toast.error("Anos de contrato deve ser entre 1 e 5");

    setSubmitting(true);
    const payload: any = {
      jogador_id: player.id,
      clube_comprador_id: myClub.id,
      clube_vendedor_id: player.club_id,
      valor_ofertado: tipo === "emprestimo" ? 0 : valorNum,
      salario_ofertado: parseFloat(salario),
      luvas: tipo === "compra" ? luvasNum : 0,
      tipo,
      anos_contrato: a,
      created_by: user.id,
    };
    if (tipo === "troca") payload.jogador_trocado_id = jogadorTrocado;
    if (tipo === "emprestimo") {
      payload.duracao_emprestimo = parseInt(duracao) || 1;
      const oc = parseFloat(opcaoCompra) || 0;
      if (oc > 0) payload.opcao_compra = oc;
    }
    if (tipo === "compra") {
      const pct = parseFloat(percentualRevenda) || 0;
      if (pct > 0) payload.percentual_revenda = pct;
    }

    const { error } = await supabase.from("transferencias").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Proposta enviada!");
    onSent?.();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Negociar jogador</DialogTitle>
          <DialogDescription>
            {player && (
              <>
                Por <strong>{player.name}</strong> · valor base {formatCurrency(base)}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {player && (
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as TransferType)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="compra">Compra</TabsTrigger>
              <TabsTrigger value="emprestimo">Empréstimo</TabsTrigger>
              <TabsTrigger value="troca">Troca</TabsTrigger>
            </TabsList>

            <TabsContent value="compra" className="space-y-3 mt-3">
              <div>
                <Label>Valor da transferência (€)</Label>
                <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
                <div className="text-[11px] text-muted-foreground mt-1">
                  Faixa Fair Play: {formatCurrency(base * 0.5)} – {formatCurrency(base * 3.0)}
                </div>
              </div>
              <div>
                <Label>Salário ofertado (€/ano)</Label>
                <Input type="number" value={salario} onChange={(e) => setSalario(e.target.value)} />
              </div>
              <div>
                <Label>Luvas (€)</Label>
                <Input type="number" value={luvas} onChange={(e) => setLuvas(e.target.value)} />
                <div className="text-[11px] text-muted-foreground mt-1">
                  Total à vista: <strong>{formatCurrency(total)}</strong> · Caixa: {formatCurrency(caixa)}
                </div>
              </div>
              <div>
                <Label>Anos de contrato</Label>
                <Input type="number" value={anos} onChange={(e) => setAnos(e.target.value)} min={1} max={5} />
              </div>
              <div>
                <Label>Cláusula de revenda (%) — opcional</Label>
                <Input type="number" value={percentualRevenda} onChange={(e) => setPercentualRevenda(e.target.value)} min={0} max={50} />
              </div>
            </TabsContent>

            <TabsContent value="emprestimo" className="space-y-3 mt-3">
              <div>
                <Label>Duração (temporadas)</Label>
                <Input type="number" value={duracao} onChange={(e) => setDuracao(e.target.value)} min={1} max={3} />
              </div>
              <div>
                <Label>Salário pago pelo empréstimo (€/ano)</Label>
                <Input type="number" value={salario} onChange={(e) => setSalario(e.target.value)} />
              </div>
              <div>
                <Label>Anos de contrato</Label>
                <Input type="number" value={anos} onChange={(e) => setAnos(e.target.value)} min={1} max={5} />
              </div>
              <div>
                <Label>Opção de compra (€) — opcional</Label>
                <Input type="number" value={opcaoCompra} onChange={(e) => setOpcaoCompra(e.target.value)} min={0} />
              </div>
            </TabsContent>

            <TabsContent value="troca" className="space-y-3 mt-3">
              <div>
                <Label>Jogador que você oferece</Label>
                <Select value={jogadorTrocado} onValueChange={setJogadorTrocado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione do seu elenco..." />
                  </SelectTrigger>
                  <SelectContent>
                    {myPlayers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.position} · {p.name} ({formatCurrency(Number(p.valor_base_calculado))})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Diferença em dinheiro (€) — opcional</Label>
                <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} min={0} />
              </div>
              <div>
                <Label>Salário ofertado ao jogador-alvo (€/ano)</Label>
                <Input type="number" value={salario} onChange={(e) => setSalario(e.target.value)} />
              </div>
              <div>
                <Label>Anos de contrato</Label>
                <Input type="number" value={anos} onChange={(e) => setAnos(e.target.value)} min={1} max={5} />
              </div>
            </TabsContent>

            {fpError && (
              <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {fpError}
              </div>
            )}
            {caixaError && !fpError && (
              <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {caixaError}
              </div>
            )}
            {trocaError && (
              <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {trocaError}
              </div>
            )}
          </Tabs>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!!fpError || !!caixaError || !!trocaError || submitting}
            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
          >
            {submitting ? "Enviando..." : "Enviar proposta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
