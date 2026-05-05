import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Telescope, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkillDisplay } from "@/components/SkillDisplay";
import { POSITIONS } from "@/lib/format";
import { getFlagUrl } from "@/lib/countries";
import type { ScoutReport } from "@/lib/scout";
import { toast } from "sonner";

interface Props {
  targetClub?: any;
  players?: any[];
  myClub: any | null;
  scoutReports: Record<string, ScoutReport>;
  onReportCreated: (report: ScoutReport, novoUsado: number) => void;
}

// ─── Componente para a Bandeira ─────────────────────────────────────────────
function FlagImg({ nationality }: { nationality: string }) {
  const url = getFlagUrl(nationality);
  if (!url) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <img
      src={url}
      alt={nationality}
      title={nationality}
      className="h-6 w-8 object-cover rounded-sm"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
    />
  );
}

export const ScoutsManager = ({ myClub, scoutReports, onReportCreated }: Props) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("todas");
  const [ageMin, setAgeMin] = useState<string>("16");
  const [ageMax, setAgeMax] = useState<string>("35");

  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [scoutingId, setScoutingId] = useState<string | null>(null);

  // Agora guardamos o objeto completo do clube para ter o escudo (crest_url)
  const [clubsMap, setClubsMap] = useState<Record<string, { id: string; name: string; crest_url: string | null }>>({});

  useEffect(() => {
    const fetchClubs = async () => {
      // Adicionamos o crest_url na busca
      const { data } = await supabase.from("clubs").select("id, name, crest_url");
      if (data) {
        const map: Record<string, any> = {};
        data.forEach((c) => (map[c.id] = c));
        setClubsMap(map);
      }
    };
    fetchClubs();
  }, []);

  const handleSearch = async () => {
    setIsSearching(true);
    setHasSearched(true);
    setResults([]);

    try {
      // 1. Query para profissionais (usando 'habilidade')
      let pQuery = supabase.from("players").select("id, name, position, age, habilidade, nationality, club_id");
      if (searchTerm) pQuery = pQuery.ilike("name", `%${searchTerm}%`);
      if (positionFilter !== "todas") pQuery = pQuery.eq("position", positionFilter);
      if (ageMin) pQuery = pQuery.gte("age", parseInt(ageMin) || 0);
      if (ageMax) pQuery = pQuery.lte("age", parseInt(ageMax) || 99);
      if (myClub) pQuery = pQuery.neq("club_id", myClub.id);

      // 2. Query para base (usando 'skill')
      let aQuery = supabase.from("academy_players").select("id, name, position, age, skill, nationality, club_id");
      if (searchTerm) aQuery = aQuery.ilike("name", `%${searchTerm}%`);
      if (positionFilter !== "todas") aQuery = aQuery.eq("position", positionFilter);
      if (ageMin) aQuery = aQuery.gte("age", parseInt(ageMin) || 0);
      if (ageMax) aQuery = aQuery.lte("age", parseInt(ageMax) || 99);
      if (myClub) aQuery = aQuery.neq("club_id", myClub.id);

      const [pRes, aRes] = await Promise.all([pQuery, aQuery]);

      if (pRes.error) throw pRes.error;
      if (aRes.error) throw aRes.error;

      const combined = [
        ...(pRes.data || []).map((p: any) => ({ ...p, skill: p.habilidade, source: "Profissional" })),
        ...(aRes.data || []).map((p: any) => ({ ...p, source: "Base" })),
      ];

      combined.sort((a, b) => b.skill - a.skill);
      setResults(combined);
    } catch (error: any) {
      toast.error("Erro ao buscar jogadores: " + error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const pesquisarPotencial = async (playerId: string) => {
    if (!myClub) return toast.error("Sem clube associado.");

    const player = results.find((p) => p.id === playerId);
    if (!player) return;

    setScoutingId(playerId);

    try {
      const rpcName = player.source === "Base" ? "scout_academy_player" : "scout_player";

      const { data, error } = await supabase.rpc(rpcName as any, {
        _scouter_club_id: myClub.id,
        _target_player_id: playerId,
      });

      if (error) throw error;

      const res: any = data;

      onReportCreated(
        {
          target_player_id: playerId,
          potential_min_revelado: res.potential_min,
          potential_max_revelado: res.potential_max,
          margem_aplicada: res.margem,
        } as ScoutReport,
        res.searches_used,
      );

      if (res.ja_existia) {
        toast.info("Relatório já existia — não consumiu pesquisa.");
      } else {
        toast.success(`Olheiro analisou o jogador (margem ±${res.margem}).`);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao pesquisar potencial");
    } finally {
      setScoutingId(null);
    }
  };

  const searchesUsed = myClub?.scout_searches_used ?? 0;
  const limite = 10;
  const restantes = Math.max(0, limite - searchesUsed);

  return (
    <div className="space-y-6 mt-4">
      <div className="flex items-center justify-between bg-primary/10 border border-primary/20 p-4 rounded-lg">
        <div>
          <h3 className="font-display font-bold text-lg text-primary flex items-center gap-2">
            <Telescope className="h-5 w-5" />
            Rede de Olheiros Global
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Busque jogadores no mundo inteiro. Pesquisar o potencial consumirá os usos do seu olheiro.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-display font-bold gold-text">{restantes}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pesquisas Restantes</div>
        </div>
      </div>

      <Card className="p-4 border-border/50 bg-gradient-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-1 md:col-span-1">
            <Label className="text-xs">Nome do Jogador</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Ex: Silva..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 bg-background/50 h-9 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Posição</Label>
            <Select value={positionFilter} onValueChange={setPositionFilter}>
              <SelectTrigger className="h-9 bg-background/50 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as Posições</SelectItem>
                {POSITIONS.map((pos) => (
                  <SelectItem key={pos} value={pos}>
                    {pos}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 flex gap-2">
            <div className="flex-1">
              <Label className="text-xs">Idade Min.</Label>
              <Input
                type="number"
                min="14"
                max="45"
                value={ageMin}
                onChange={(e) => setAgeMin(e.target.value)}
                className="h-9 bg-background/50 text-xs"
              />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Idade Máx.</Label>
              <Input
                type="number"
                min="14"
                max="45"
                value={ageMax}
                onChange={(e) => setAgeMax(e.target.value)}
                className="h-9 bg-background/50 text-xs"
              />
            </div>
          </div>

          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90 h-9"
          >
            {isSearching ? "Procurando..." : "Buscar Jogadores"}
          </Button>
        </div>
      </Card>

      {hasSearched && (
        <Card className="overflow-hidden border-border/50">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead className="hidden sm:table-cell w-16">Nac.</TableHead>
                <TableHead>Clube</TableHead>
                <TableHead className="text-center w-16">Pos</TableHead>
                <TableHead className="text-center w-16">Idade</TableHead>
                <TableHead className="text-center w-32">Habilidade</TableHead>
                <TableHead className="w-44">Potencial</TableHead>
                <TableHead className="text-right w-24"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum jogador encontrado com estes filtros.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((p) => {
                  const rep = scoutReports[p.id];
                  const club = clubsMap[p.club_id];

                  return (
                    <TableRow key={`${p.id}-${p.source}`} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-medium">
                        <span className="truncate max-w-[180px] block">{p.name}</span>
                      </TableCell>

                      <TableCell className="py-2 hidden sm:table-cell">
                        <FlagImg nationality={p.nationality || ""} />
                      </TableCell>

                      <TableCell>
                        {club ? (
                          <div className="flex items-center gap-3">
                            <Link
                              to={`/clubes/${club.id}`}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              <div className="h-7 w-7 shrink-0 flex items-center justify-center">
                                {club.crest_url ? (
                                  <img src={club.crest_url} alt={club.name} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full bg-secondary rounded-full" />
                                )}
                              </div>
                              <span className="text-sm hidden md:inline">{club.name}</span>
                            </Link>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {p.position}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center text-xs tabular-nums">{p.age}</TableCell>

                      <TableCell className="text-center">
                        <SkillDisplay value={p.skill} rate={undefined} kind="skill" />
                      </TableCell>

                      <TableCell className="py-2">
                        {rep ? (
                          <div className="flex items-center gap-1.5" title={`Margem: ±${rep.margem_aplicada || "?"}`}>
                            <SkillDisplay
                              value={rep.potential_max_revelado}
                              valueMin={rep.potential_min_revelado}
                              rate={undefined}
                              kind="potential"
                              numericLabel={`${rep.potential_min_revelado}-${rep.potential_max_revelado}`}
                            />
                          </div>
                        ) : (
                          <div
                            className="flex items-center gap-0.5 text-muted-foreground/30"
                            title="Use a aba Olheiros para descobrir"
                          >
                            {Array.from({ length: 5 }).map((_, i) => (
                              <Star key={i} style={{ width: 14, height: 14 }} />
                            ))}
                            <span className="text-[10px] ml-1.5"></span>
                          </div>
                        )}
                      </TableCell>

                      <TableCell className="py-2 text-right">
                        {!rep && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={restantes <= 0 || scoutingId === p.id}
                            onClick={() => pesquisarPotencial(p.id)}
                            className="h-7 text-[10px] px-2 shrink-0"
                          >
                            <Telescope className="h-3 w-3 sm:mr-1" />
                            <span className="hidden sm:inline">{scoutingId === p.id ? "..." : "Analisar"}</span>
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
      )}
    </div>
  );
};

export default ScoutsManager;
