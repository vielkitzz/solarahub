import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { SkillDisplay } from "@/components/SkillDisplay";
import { getFlagUrl } from "@/lib/countries";
import { Heart, ArrowRightLeft, FileSignature, Gavel, Shield, ExternalLink, Star, Loader2 } from "lucide-react";
import { useInterestList } from "@/hooks/useInterestList";
import { ContractRenewalDialog } from "@/components/ContractRenewalDialog";
import { MultaRescisoriaDialog } from "@/components/MultaRescisoriaDialog";

interface Props {
  playerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNegotiate?: (player: any) => void;
}

export const PlayerProfileDialog = ({ playerId, open, onOpenChange, onNegotiate }: Props) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<any>(null);
  const [myClub, setMyClub] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [renewOpen, setRenewOpen] = useState(false);
  const [multaOpen, setMultaOpen] = useState(false);

  const { has, toggle } = useInterestList();

  useEffect(() => {
    if (open && playerId) {
      fetchData();
    } else {
      setPlayer(null);
      setReport(null);
    }
  }, [open, playerId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: p, error } = await supabase
        .from("players")
        .select(
          `
        id, name, position, age, nationality,
        habilidade, habilidade_anterior,
        potential_min, potential_max,
        market_value, salario_atual, valor_base_calculado,
        contrato_ate, a_venda, club_id,
        clubs (
          id, name, crest_url, rate, owner_id
        )
      `,
        )
        .eq("id", playerId)
        .single();

      if (error) throw error;
      setPlayer(p);

      if (user) {
        const { data: c } = await supabase.from("clubs").select("*").eq("owner_id", user.id).maybeSingle();
        setMyClub(c);

        if (c && p && c.id !== p.club_id) {
          const { data: r } = await supabase
            .from("scout_reports")
            .select("*")
            .eq("scouter_club_id", c.id)
            .eq("target_player_id", playerId)
            .maybeSingle();
          setReport(r);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar perfil:", err);
    } finally {
      setLoading(false);
    }
  };

  const isOwn = !!(player?.club_id && myClub?.id === player.club_id);
  const clubRate = player?.clubs?.rate ?? null;

  // Potencial: dono vê real (min e max), outros só com relatório de olheiro
  const potDisplay = useMemo(() => {
    if (!player) return null;

    if (isOwn) {
      // Dono vê o range real do jogador
      const min = player.potential_min;
      const max = player.potential_max;
      if (min == null || max == null) return null;
      const sameValue = min === max;
      return {
        value: max,
        min: sameValue ? undefined : min,
        label: sameValue ? String(max) : `${min}-${max}`,
        tooltip: "Potencial real (visto apenas pelo dono)",
      };
    }

    if (report) {
      return {
        value: report.potential_max_revelado,
        min: report.potential_min_revelado,
        label: `${report.potential_min_revelado}-${report.potential_max_revelado}`,
        tooltip: `Relatório de olheiro (margem ±${report.margem_aplicada})`,
      };
    }

    return null;
  }, [player, isOwn, report]);

  // Contrato: contrato_ate é a temporada de término (número absoluto)
  const contratoLabel = useMemo(() => {
    if (player?.contrato_ate == null) return "—";
    return `até temp. ${player.contrato_ate}`;
  }, [player]);

  // Contrato expirando: considera "curto" se faltar ≤ 2 temporadas
  // Como não temos a temporada atual aqui, apenas exibimos o valor
  const contratoUrgente = false; // ajuste se tiver acesso à temporada atual

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden bg-background border-border/50">
          {loading ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !player ? (
            <div className="p-8 text-center text-muted-foreground">Jogador não encontrado.</div>
          ) : (
            <>
              {/* Header */}
              <div className="relative h-32 bg-gradient-to-br from-secondary to-background p-6 flex items-end gap-4">
                <div className="h-20 w-20 bg-card rounded-xl border border-border/50 flex items-center justify-center p-2 shadow-xl">
                  {player.clubs?.crest_url ? (
                    <img
                      src={player.clubs.crest_url}
                      alt={player.clubs.name}
                      className="max-h-full max-w-full object-contain"
                    />
                  ) : (
                    <Shield className="h-10 w-10 text-muted-foreground/20" />
                  )}
                </div>
                <div className="mb-1">
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={getFlagUrl(player.nationality)}
                      alt={player.nationality}
                      className="h-3 w-4 object-cover rounded-sm"
                    />
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-widest">
                      {player.position} • {player.age} anos
                    </span>
                  </div>
                  <DialogTitle className="text-2xl font-display font-bold leading-none">{player.name}</DialogTitle>
                </div>
              </div>

              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Coluna Esquerda */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Habilidade Atual
                      </span>
                      <SkillDisplay value={player.habilidade} rate={clubRate} kind="skill" />
                    </div>

                    <div className="space-y-1">
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Potencial
                      </span>
                      {potDisplay ? (
                        <div title={potDisplay.tooltip}>
                          <SkillDisplay
                            value={potDisplay.value}
                            valueMin={potDisplay.min}
                            rate={clubRate}
                            kind="potential"
                            numericLabel={potDisplay.label}
                          />
                        </div>
                      ) : (
                        <div
                          className="flex items-center gap-0.5 text-muted-foreground/20"
                          title="Use a aba Olheiros para descobrir"
                        >
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} style={{ width: 16, height: 16 }} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <Separator className="opacity-50" />

                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Clube</span>
                      <Link
                        to={`/clubes/${player.club_id}`}
                        className="font-semibold hover:text-primary flex items-center gap-1"
                      >
                        {player.clubs?.name} <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Valor de Mercado</span>
                      <span className="font-display font-bold text-primary">{formatCurrency(player.market_value)}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Salário</span>
                      <span className="font-medium">
                        {player.salario_atual != null ? `${formatCurrency(player.salario_atual)}/mês` : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Contrato */}
                <div className="bg-secondary/20 rounded-xl p-4 border border-border/50 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-tighter text-muted-foreground flex items-center gap-2">
                    <FileSignature className="h-3 w-3" /> Situação Contratual
                  </h4>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Fim do Contrato</span>
                      <span className={contratoUrgente ? "text-destructive font-bold" : ""}>{contratoLabel}</span>
                    </div>
                    {/* Multa rescisória não existe na tabela players — omitida */}
                  </div>

                  <div className="pt-2">
                    {player.a_venda ? (
                      <Badge className="w-full justify-center bg-destructive/10 text-destructive border-destructive/20 py-1">
                        Listado para Transferência
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="w-full justify-center opacity-50 py-1">
                        Não está à venda
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-secondary/10 border-t border-border/50 flex flex-wrap gap-2 justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className={has(player.id) ? "text-primary" : "text-muted-foreground"}
                  onClick={() => toggle(player.id)}
                >
                  <Heart className={`h-4 w-4 mr-2 ${has(player.id) ? "fill-primary" : ""}`} />
                  {has(player.id) ? "Na lista" : "Interesse"}
                </Button>

                <div className="flex gap-2">
                  {isOwn ? (
                    <>
                      <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)}>
                        <FileSignature className="h-3.5 w-3.5 mr-2 text-primary" /> Renovar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setMultaOpen(true)}>
                        <Gavel className="h-3.5 w-3.5 mr-2 text-amber-400" /> Multa
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground"
                        onClick={() => (onNegotiate ? onNegotiate(player) : navigate("/mercado"))}
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Fazer proposta
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => setMultaOpen(true)}
                      >
                        <Gavel className="h-3.5 w-3.5 mr-2" /> Pagar Multa
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {player && (
        <>
          <ContractRenewalDialog
            player={player}
            open={renewOpen}
            onOpenChange={setRenewOpen}
            onRenewed={() => fetchData()}
          />
          <MultaRescisoriaDialog
            player={player}
            open={multaOpen}
            onOpenChange={setMultaOpen}
            myClubId={myClub?.id || null}
            isAdmin={false}
            onDone={() => fetchData()}
          />
        </>
      )}
    </>
  );
};
