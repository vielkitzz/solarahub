import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Globe2, Check, X, MessageSquare, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";

interface Props {
  clubId: string;
}

export const ExternalProposalsInbox = ({ clubId }: Props) => {
  const [props_, setProps_] = useState<any[]>([]);
  const [counter, setCounter] = useState<any | null>(null);
  const [cValor, setCValor] = useState("");
  const [cSalario, setCSalario] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    // Busca jogadores do clube
    const { data: pls } = await supabase.from("players").select("id, name, habilidade, position").eq("club_id", clubId);

    const ids = (pls || []).map((p) => p.id);
    if (ids.length === 0) {
      setProps_([]);
      return;
    }

    // Busca propostas pendentes para esses jogadores
    const { data: proposals, error } = await supabase
      .from("external_proposals")
      .select("*")
      .in("player_id", ids)
      .eq("status", "pendente")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("external_proposals error:", error);
      setProps_([]);
      return;
    }
    if (!proposals || proposals.length === 0) {
      setProps_([]);
      return;
    }

    // Busca clubes externos separadamente
    const ecIds = [...new Set(proposals.map((p) => p.external_club_id))];
    const { data: ecs } = await supabase
      .from("external_clubs")
      .select("id, name, country, crest, prestige")
      .in("id", ecIds);

    const ecMap: Record<string, any> = {};
    (ecs || []).forEach((ec) => {
      ecMap[ec.id] = ec;
    });

    const plMap: Record<string, any> = {};
    (pls || []).forEach((pl) => {
      plMap[pl.id] = pl;
    });

    // Monta lista enriquecida
    const enriched = proposals.map((p) => ({
      ...p,
      external_club: ecMap[p.external_club_id] || null,
      player: plMap[p.player_id] || null,
    }));

    setProps_(enriched);
  };

  useEffect(() => {
    load();
  }, [clubId]);

  const responder = async (id: string, acao: "aceitar" | "recusar") => {
    setBusy(true);
    const { error } = await supabase.rpc("responder_proposta_externa", { _id: id, _acao: acao });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(acao === "aceitar" ? "Proposta aceita" : "Proposta recusada");
    load();
  };

  const enviarContraproposta = async () => {
    if (!counter) return;
    const valor = Number(cValor);
    const salario = Number(cSalario);
    if (!valor || !salario) return toast.error("Informe valor e salário");
    setBusy(true);
    const { data: nova, error } = await supabase.rpc("responder_proposta_externa", {
      _id: counter.id,
      _acao: "contraproposta",
      _novo_valor: valor,
      _novo_salario: salario,
    });
    if (error) {
      setBusy(false);
      return toast.error(error.message);
    }
    await supabase.functions.invoke("external-ai-respond", { body: { proposal_id: nova } });
    setBusy(false);
    setCounter(null);
    setCValor("");
    setCSalario("");
    toast.success("Contraproposta enviada — aguardando resposta da IA");
    load();
  };

  if (props_.length === 0) {
    return (
      <Card className="p-4 text-sm text-muted-foreground bg-gradient-card border-border/50">
        <Globe2 className="h-4 w-4 inline mr-2" />
        Nenhuma proposta de clubes estrangeiros no momento.
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {props_.map((p) => (
        <Card key={p.id} className="p-3 bg-gradient-card border-border/50 flex flex-wrap items-center gap-3">
          {p.external_club?.crest && <img src={p.external_club.crest} alt="" className="h-10 w-10 object-contain" />}
          <div className="flex-1 min-w-0">
            <div className="font-medium">
              {p.external_club?.name ?? "Clube desconhecido"}{" "}
              <span className="text-xs text-muted-foreground">({p.external_club?.country ?? "—"})</span>
            </div>
            <div className="text-sm text-muted-foreground">
              Oferta por <strong>{p.player?.name ?? "Jogador"}</strong> ({p.player?.position ?? "—"} · OVR{" "}
              {p.player?.habilidade ?? "—"})
            </div>
            <div className="text-xs mt-0.5">
              Valor: <strong>{formatCurrency(p.valor_ofertado)}</strong> · Salário:{" "}
              <strong>{formatCurrency(p.salario_ofertado)}/ano</strong>
              {p.mensagem && <span className="ml-2 italic text-muted-foreground">"{p.mensagem}"</span>}
            </div>
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="sm"
              onClick={() => responder(p.id, "aceitar")}
              disabled={busy}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              <Check className="h-3.5 w-3.5 mr-1" /> Aceitar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setCounter(p);
                setCValor(String(p.valor_ofertado));
                setCSalario(String(p.salario_ofertado));
              }}
              className="border-primary/40 text-primary hover:bg-primary/10"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" /> Contra-propor
            </Button>
            <Button size="sm" variant="ghost" onClick={() => responder(p.id, "recusar")} disabled={busy}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>
      ))}

      <Dialog open={!!counter} onOpenChange={(o) => !o && setCounter(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contraproposta para {counter?.external_club?.name}</DialogTitle>
            <DialogDescription>Edite os valores e envie sua contraproposta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Novo valor pedido (€)</Label>
              <Input type="number" value={cValor} onChange={(e) => setCValor(e.target.value)} />
            </div>
            <div>
              <Label>Novo salário (€/ano)</Label>
              <Input type="number" value={cSalario} onChange={(e) => setCSalario(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounter(null)}>
              Cancelar
            </Button>
            <Button
              onClick={enviarContraproposta}
              disabled={busy}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {busy && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
