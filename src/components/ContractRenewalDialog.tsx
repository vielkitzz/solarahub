import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { Loader2, FileSignature, Check, X } from "lucide-react";

interface Props {
  player: any;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onRenewed: () => void;
}

export const ContractRenewalDialog = ({ player, open, onOpenChange, onRenewed }: Props) => {
  const baseSalario = Number(player?.salario_atual || 0);
  const [salario, setSalario] = useState<number>(baseSalario);
  const [anos, setAnos] = useState<number>(3);
  const [sugerido, setSugerido] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState<{
    aceita: boolean;
    justificativa: string;
    contraproposta?: { salario: number | null; anos: number | null } | null;
  } | null>(null);

  const reset = () => {
    setResultado(null);
    setSalario(baseSalario);
    setAnos(3);
  };

  useEffect(() => {
    if (!open || !player?.id) return;
    supabase.rpc("sugerir_salario_jogador", { _jogador_id: player.id }).then(({ data }) => {
      if (data) setSugerido(Math.round(Number(data)));
    });
  }, [open, player?.id]);

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const aplicarContraproposta = () => {
    if (!resultado?.contraproposta) return;
    if (resultado.contraproposta.salario) setSalario(Math.round(resultado.contraproposta.salario));
    if (resultado.contraproposta.anos) setAnos(Math.max(1, Math.min(5, Math.round(resultado.contraproposta.anos))));
    setResultado(null);
  };

  const negociar = async () => {
    if (!salario || salario <= 0) return toast.error("Informe um salário válido");
    if (anos < 1 || anos > 5) return toast.error("Duração entre 1 e 5 anos");
    setLoading(true);
    setResultado(null);
    try {
      const { data, error } = await supabase.functions.invoke("renovar-contrato", {
        body: {
          jogador_id: player.id,
          salario_proposto: salario,
          anos_proposto: anos,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setResultado(data);
      if (data.aceita) {
        toast.success("Contrato renovado!");
        onRenewed();
      } else {
        toast.info("Agente recusou a proposta");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao negociar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" /> Renovar contrato
          </DialogTitle>
          <DialogDescription>
            Negocie a renovação de <span className="font-semibold text-foreground">{player?.name}</span> com o agente.
          </DialogDescription>
        </DialogHeader>

        <Card className="p-3 bg-secondary/40 border-border/50 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Salário atual</span>
            <span className="font-mono">{formatCurrency(baseSalario)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor base</span>
            <span className="font-mono">{formatCurrency(Number(player?.valor_base_calculado || 0))}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Idade / Overall</span>
            <span className="font-mono">
              {player?.age ?? "—"} / {player?.habilidade ?? "—"}
            </span>
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Salário anual (€)</Label>
            <NumberInput
              value={salario}
              onChange={(v) => setSalario(v)}
              min={0}
              disabled={loading}
            />
            {sugerido > 0 && (
              <button
                type="button"
                onClick={() => setSalario(sugerido)}
                className="text-[11px] text-primary hover:underline mt-1"
              >
                Sugerido: {formatCurrency(sugerido)}/ano
              </button>
            )}
          </div>
          <div>
            <Label>Duração (anos)</Label>
            <NumberInput
              value={anos}
              onChange={(v) => setAnos(v)}
              min={1}
              max={5}
              thousands={false}
              disabled={loading}
            />
          </div>
        </div>

        {resultado && (
          <Card
            className={`p-3 border ${
              resultado.aceita ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
            }`}
          >
            <div className="flex items-start gap-2">
              {resultado.aceita ? (
                <Check className="h-4 w-4 text-success mt-0.5 shrink-0" />
              ) : (
                <X className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              )}
              <div className="text-sm space-y-2">
                <p className="italic">"{resultado.justificativa}"</p>
                {!resultado.aceita && resultado.contraproposta && (resultado.contraproposta.salario || resultado.contraproposta.anos) && (
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Contraproposta: {resultado.contraproposta.salario ? formatCurrency(resultado.contraproposta.salario) : "—"}
                      {resultado.contraproposta.anos ? ` por ${resultado.contraproposta.anos} ano(s)` : ""}
                    </p>
                    <Button size="sm" variant="outline" className="mt-1" onClick={aplicarContraproposta}>
                      Aplicar contraproposta
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading}>
            Fechar
          </Button>
          {!(resultado?.aceita) && (
            <Button onClick={negociar} disabled={loading} className="bg-gradient-gold text-primary-foreground">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSignature className="h-4 w-4" />}
              Negociar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
