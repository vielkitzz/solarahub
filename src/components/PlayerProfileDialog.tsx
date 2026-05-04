import { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import { SkillDisplay } from "@/components/SkillDisplay";
import { getFlagUrl } from "@/lib/countries";
import { Heart, ArrowRightLeft, FileSignature, Gavel, Shield, ExternalLink, Star, Loader2 } from "lucide-react";
import { useInterestList } from "@/hooks/useInterestList";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { estimarPotencialOwn } from "@/lib/scout";
import { ContractRenewalDialog } from "@/components/ContractRenewalDialog";
import { MultaRescisoriaDialog } from "@/components/MultaRescisoriaDialog";

interface Props {
  playerId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Callback ao clicar em Negociar (recebe player). Se omitido, navega para /mercado. */
  onNegotiate?: (player: any) => void;
}

export const PlayerProfileDialog = ({ playerId, open, onOpenChange, onNegotiate }: Props) => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { has, toggle } = useInterestList();
  const { prefs } = useUserPreferences();
  const [player, setPlayer] = useState<any | null>(null);
  const [club, setClub] = useState<any | null>(null);
  const [myClub, setMyClub] = useState<any | null>(null);
  const [scoutReport, setScoutReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [renewOpen, setRenewOpen] = useState(false);
  const [multaOpen, setMultaOpen] = useState(false);

  useEffect(() => {
    if (!open || !playerId) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: p } = await supabase.from("players").select("*").eq("id", playerId).maybeSingle();
      if (cancelled) return;
      setPlayer(p);
      if (p?.club_id) {
        const { data: c } = await supabase.from("clubs").select("*").eq("id", p.club_id).maybeSingle();
        if (!cancelled) setClub(c);
      } else {
        setClub(null);
      }
      if (user) {
        const { data: mine } = await supabase.from("clubs").select("*").eq("owner_id", user.id).maybeSingle();
        if (!cancelled) setMyClub(mine);
        if (mine && p) {
          const { data: rep } = await supabase
            .from("scout_reports")
            .select("*")
            .eq("scouter_club_id", mine.id)
            .eq("target_player_id", p.id)
            .maybeSingle();
          if (!cancelled) setScoutReport(rep);
        }
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, playerId, user?.id]);

  const isOwn = !!myClub && !!player && player.club_id === myClub.id;
  const flagUrl = player?.nationality ? getFlagUrl(player.nationality) : null;

  // Potencial: dono vê estimativa via base; admin vê real; outros só veem via scout report
  const potencial = useMemo(() => {
    if (!player) return null;
    if (isOwn && myClub) {
      const est = estimarPotencialOwn(player, myClub.id, myClub.nivel_base);
      if (est) return { label: `~${est.pmin}-${est.pmax}`, tooltip: `Estimativa do seu olheiro (±${est.margem})`, value: est.pmax };
    }
    if (isAdmin && player.potential_max) {
      return { label: `${player.potential_min}-${player.potential_max}`, tooltip: "Visão de admin", value: player.potential_max };
    }
    if (scoutReport) {
      return { label: `~${scoutReport.potential_min_revelado}-${scoutReport.potential_max_revelado}`, tooltip: `Relatório do olheiro (±${scoutReport.margem_aplicada})`, value: scoutReport.potential_max_revelado };
    }
    return null;
  }, [player, isOwn, isAdmin, scoutReport, myClub]);

  const inInterest = playerId ? has(playerId) : false;

  const handleNegotiate = () => {
    if (onNegotiate && player) {
      onNegotiate(player);
    } else if (player) {
      onOpenChange(false);
      navigate(`/mercado?player=${player.id}`);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl">
          {loading || !player ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-start gap-3">
                  <Badge variant="outline" className="border-primary/40 text-primary text-sm font-bold">
                    {player.position}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-xl flex items-center gap-2 flex-wrap">
                      <span className="truncate">{player.name}</span>
                      {flagUrl && <img src={flagUrl} alt={player.nationality} title={player.nationality} className="h-4 w-6 object-cover rounded-sm" />}
                      {player.shirt_number && <span className="text-sm text-muted-foreground">#{player.shirt_number}</span>}
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                      {player.age ? `${player.age} anos` : "Idade ?"} {player.nationality ? `· ${player.nationality}` : ""}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Clube */}
              {club ? (
                <Link to={`/clubes/${club.id}`} onClick={() => onOpenChange(false)} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/40 hover:bg-secondary/60 transition-colors group">
                  <div className="h-10 w-10 flex items-center justify-center shrink-0">
                    {club.crest_url ? <img src={club.crest_url} alt={club.name} className="h-full w-full object-contain" /> : <Shield className="h-6 w-6 text-muted-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate group-hover:text-primary">{club.name}</div>
                    <div className="text-[10px] text-muted-foreground">Rate {Number(club.rate).toFixed(2)} · {club.city || ""}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </Link>
              ) : (
                <div className="text-xs text-muted-foreground p-3 bg-secondary/30 rounded-lg">Sem clube (livre).</div>
              )}

              {/* Atributos principais */}
              <div className="grid grid-cols-2 gap-2">
                <Card className="p-3 bg-gradient-card border-border/50">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Habilidade</div>
                  <div className="mt-1">
                    <SkillDisplay value={player.habilidade} rate={club?.rate} kind="skill" />
                    {!prefs.show_numeric_skill && <div className="text-[10px] text-muted-foreground mt-1">Real: {player.habilidade}</div>}
                  </div>
                </Card>
                <Card className="p-3 bg-gradient-card border-border/50">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Potencial</div>
                  <div className="mt-1" title={potencial?.tooltip}>
                    {potencial ? (
                      <SkillDisplay value={potencial.value} rate={club?.rate} kind="potential" numericLabel={prefs.show_numeric_potential ? potencial.label : undefined} />
                    ) : (
                      <div className="flex items-center gap-1 text-muted-foreground/40">
                        {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-3 w-3" />)}
                        <span className="text-[10px] ml-2">Sem dados</span>
                      </div>
                    )}
                    {potencial && <div className="text-[10px] text-muted-foreground mt-1">{potencial.label}</div>}
                  </div>
                </Card>
                <Card className="p-3 bg-gradient-card border-border/50">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Valor de mercado</div>
                  <div className="font-display font-bold text-primary">{formatCurrency(Number(player.market_value || 0))}</div>
                  <div className="text-[10px] text-muted-foreground">Base: {formatCurrency(Number(player.valor_base_calculado || 0))}</div>
                </Card>
                <Card className="p-3 bg-gradient-card border-border/50">
                  <div className="text-[10px] uppercase text-muted-foreground tracking-wider">Salário / Contrato</div>
                  <div className="font-display font-bold">{formatCurrency(Number(player.salario_atual || 0))}/ano</div>
                  <div className="text-[10px] text-muted-foreground">Até {player.contrato_ate ?? "—"}</div>
                </Card>
              </div>

              <Separator />

              {/* Ações */}
              <div className="flex flex-wrap gap-2">
                {user && (
                  <Button
                    variant={inInterest ? "default" : "outline"}
                    size="sm"
                    onClick={() => playerId && toggle(playerId)}
                    className={inInterest ? "bg-primary text-primary-foreground" : ""}
                  >
                    <Heart className={`h-3.5 w-3.5 ${inInterest ? "fill-current" : ""}`} />
                    {inInterest ? "Na lista" : "Lista de interesses"}
                  </Button>
                )}
                {!isOwn && myClub && player.club_id && (
                  <Button size="sm" onClick={handleNegotiate} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                    <ArrowRightLeft className="h-3.5 w-3.5" /> Fazer proposta
                  </Button>
                )}
                {isOwn && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setRenewOpen(true)}>
                      <FileSignature className="h-3.5 w-3.5 text-primary" /> Renovar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setMultaOpen(true)}>
                      <Gavel className="h-3.5 w-3.5 text-amber-400" /> Multa
                    </Button>
                  </>
                )}
                {isAdmin && !isOwn && (
                  <Button size="sm" variant="outline" onClick={() => setMultaOpen(true)}>
                    <Gavel className="h-3.5 w-3.5 text-amber-400" /> Multa (admin)
                  </Button>
                )}
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
            onRenewed={() => { setRenewOpen(false); }}
          />
          <MultaRescisoriaDialog
            player={player}
            open={multaOpen}
            onOpenChange={setMultaOpen}
            myClubId={myClub?.id || null}
            isAdmin={isAdmin}
            onDone={() => setMultaOpen(false)}
          />
        </>
      )}
    </>
  );
};
