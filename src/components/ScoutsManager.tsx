import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Telescope, Sparkles, Eye, AlertCircle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StarRating } from "@/components/StarRating";
import { calcStars } from "@/lib/format";
import { margemPorNivelBase, type ScoutReport } from "@/lib/scout";
import { toast } from "sonner";

interface Props {
  /** Clube cuja aba está sendo visualizada (alvo das pesquisas) */
  targetClub: any;
  /** Jogadores do clube alvo */
  players: any[];
  /** Clube do usuário que está usando o olheiro */
  myClub: any | null;
  /** Reports já existentes para meu clube */
  scoutReports: Record<string, ScoutReport>;
  onReportCreated: (report: ScoutReport, novoUsado: number) => void;
}

const ScoutsManager = ({ targetClub, players, myClub, scoutReports, onReportCreated }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [scoutingId, setScoutingId] = useState<string | null>(null);
  const [searchesUsed, setSearchesUsed] = useState<number>(myClub?.scout_searches_used ?? 0);

  useEffect(() => {
    setSearchesUsed(myClub?.scout_searches_used ?? 0);
  }, [myClub?.id, myClub?.scout_searches_used]);

  const restantes = Math.max(0, 10 - searchesUsed);
  const margem = margemPorNivelBase(myClub?.nivel_base);

  const filtered = useMemo(
    () =>
      players
        .filter((p) => !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => Number(b.habilidade || 0) - Number(a.habilidade || 0)),
    [players, searchTerm],
  );

  const pesquisar = async (playerId: string) => {
    if (!myClub) return;
    setScoutingId(playerId);
    try {
      const { data, error } = await supabase.rpc("scout_player" as any, {
        _scouter_club_id: myClub.id,
        _target_player_id: playerId,
      });
      if (error) throw error;
      const res: any = data;
      const rep: ScoutReport = {
        scouter_club_id: myClub.id,
        target_player_id: playerId,
        potential_min_revelado: res.potential_min,
        potential_max_revelado: res.potential_max,
        margem_aplicada: res.margem,
      };
      onReportCreated(rep, res.searches_used);
      if (res.ja_existia) {
        toast.info("Relatório já existia — não consumiu pesquisa.");
      } else {
        toast.success(`Olheiro analisou o jogador (margem ±${res.margem}).`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao pesquisar jogador");
    } finally {
      setScoutingId(null);
    }
  };

  if (!myClub) {
    return (
      <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground space-y-2">
        <AlertCircle className="h-8 w-8 mx-auto text-amber-400" />
        <p>Você precisa ter um clube para usar o olheiro.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-br from-primary/10 via-card to-card border-border/50">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-lg bg-primary/20">
              <Telescope className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                Olheiro do {myClub.name}
                <Badge variant="outline" className="text-[10px]">
                  Base nível {myClub.nivel_base}
                </Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Pesquisas analisam o potencial de qualquer jogador. Margem de erro: <b>±{margem}</b> pontos.
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold tabular-nums">
              {restantes}
              <span className="text-base text-muted-foreground">/10</span>
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pesquisas restantes</div>
          </div>
        </div>
      </Card>

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar jogador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 h-9 text-xs bg-background/50"
        />
      </div>

      <Card className="bg-gradient-card border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/20 hover:bg-transparent border-border/50">
              <TableHead className="text-[10px] uppercase">Jogador</TableHead>
              <TableHead className="text-[10px] uppercase w-16 text-center">Idade</TableHead>
              <TableHead className="text-[10px] uppercase w-32">Qualidade</TableHead>
              <TableHead className="text-[10px] uppercase w-44">Potencial revelado</TableHead>
              <TableHead className="text-[10px] uppercase w-32 text-right">Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const rep = scoutReports[p.id];
                const stars = calcStars(p.habilidade, targetClub.rate);
                const potStarsMin = rep ? calcStars(rep.potential_min_revelado, targetClub.rate) : null;
                const potStarsMax = rep ? calcStars(rep.potential_max_revelado, targetClub.rate) : null;
                return (
                  <TableRow key={p.id} className="border-border/30 hover:bg-primary/5">
                    <TableCell className="py-2 font-medium text-sm">{p.name}</TableCell>
                    <TableCell className="py-2 text-center text-xs text-muted-foreground tabular-nums">
                      {p.age ?? "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <StarRating value={stars} />
                    </TableCell>
                    <TableCell className="py-2">
                      {rep ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground w-7">min</span>
                            <StarRating value={potStarsMin || 0} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground w-7">máx</span>
                            <StarRating value={potStarsMax || 0} />
                          </div>
                          <span className="text-[9px] text-muted-foreground">±{rep.margem_aplicada} pontos</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-muted-foreground/40">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Eye key={i} className="h-3 w-3" />
                          ))}
                          <span className="text-[10px] ml-1">desconhecido</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      {rep ? (
                        <Badge variant="secondary" className="text-[10px]">
                          <Sparkles className="h-3 w-3 mr-1" /> Analisado
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={restantes <= 0 || scoutingId === p.id}
                          onClick={() => pesquisar(p.id)}
                          className="h-7 text-xs"
                        >
                          <Telescope className="h-3 w-3 mr-1" />
                          {scoutingId === p.id ? "..." : "Pesquisar"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default ScoutsManager;
