import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Gavel, Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";

type Player = {
  id: string;
  name: string;
  club_id: string | null;
  valor_base_calculado: number;
};

export const MultaRescisoriaDialog = ({
  player,
  open,
  onOpenChange,
  myClubId,
  isAdmin,
  onDone,
}: {
  player: Player | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  myClubId: string | null;
  isAdmin: boolean;
  onDone: () => void;
}) => {
  const [mode, setMode] = useState<"comprar" | "liberar">("comprar");
  const [salario, setSalario] = useState<number>(0);
  const [anos, setAnos] = useState<number>(3);
  const [meusClubes, setMeusClubes] = useState<any[]>([]);
  const [clubeCompId, setClubeCompId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const multa = player ? Number(player.valor_base_calculado || 0) * 10 : 0;
  const isOwner = !!myClubId && player?.club_id === myClubId;

  useEffect(() => {
    if (!open || !player) return;
    setMode(isOwner && !isAdmin ? "liberar" : "comprar");
    setAnos(3);
    setSalario(Math.max(50000, Math.round(Number(player.valor_base_calculado || 0) * 0.1)));
    // Buscar clubes do usuário (para escolher quem compra)
    if (isAdmin) {
      supabase.from("clubs").select("id, name").order("name").then(({ data }) => setMeusClubes(data || []));
    } else if (myClubId) {
      supabase.from("clubs").select("id, name").eq("id", myClubId).then(({ data }) => {
        setMeusClubes(data || []);
        if (data?.[0]) setClubeCompId(data[0].id);
      });
    }
  }, [open, player?.id]);

  const submit = async () => {
    if (!player) return;
    setLoading(true);
    if (mode === "liberar") {
      const { error } = await supabase.rpc("liberar_jogador_pagando_multa", { _jogador_id: player.id });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success(`${player.name} liberado como agente livre. Multa paga: ${formatCurrency(multa)}`);
    } else {
      if (!clubeCompId) { setLoading(false); return toast.error("Escolha o clube comprador"); }
      const { error } = await supabase.rpc("pagar_multa_rescisoria", {
        _jogador_id: player.id,
        _clube_comprador_id: clubeCompId,
        _novo_salario: salario,
        _anos_contrato: anos,
      });
      setLoading(false);
      if (error) return toast.error(error.message);
      toast.success(`Multa paga! ${player.name} agora pertence ao novo clube.`);
    }
    onDone();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" /> Multa Rescisória
          </DialogTitle>
          <DialogDescription>{player?.name}</DialogDescription>
        </DialogHeader>

        <Card className="p-3 bg-secondary/30 border-border/50">
          <div className="text-[10px] uppercase text-muted-foreground">Multa (10× valor base)</div>
          <div className="font-display font-bold text-2xl text-primary">{formatCurrency(multa)}</div>
        </Card>

        {(isOwner || isAdmin) && (
          <div className="space-y-2">
            <Label>Ação</Label>
            <Select value={mode} onValueChange={(v) => setMode(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="comprar">Outro clube paga e contrata</SelectItem>
                {(isOwner || isAdmin) && <SelectItem value="liberar">Clube atual paga e libera</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        )}

        {mode === "comprar" && (
          <>
            <div className="space-y-2">
              <Label>Clube comprador</Label>
              <Select value={clubeCompId} onValueChange={setClubeCompId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {meusClubes.filter(c => c.id !== player?.club_id).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Salário/ano</Label>
                <NumberInput value={salario} onChange={setSalario} min={50000} max={50000000} />
              </div>
              <div className="space-y-2">
                <Label>Anos</Label>
                <NumberInput value={anos} onChange={setAnos} min={1} max={6} thousands={false} />
              </div>
            </div>
          </>
        )}

        {mode === "liberar" && (
          <Card className="p-3 bg-amber-500/10 border-amber-500/30">
            <div className="flex gap-2 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
              <span>O clube pagará {formatCurrency(multa)} e o jogador se tornará agente livre.</span>
            </div>
          </Card>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Pagar multa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
