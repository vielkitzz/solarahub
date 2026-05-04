import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Telescope, Sparkles, Star, Shield } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SkillDisplay } from "@/components/SkillDisplay";
import { POSITIONS } from "@/lib/format";
import type { ScoutReport } from "@/lib/scout";
import { toast } from "sonner";

interface Props {
  targetClub?: any; // Mantido para compatibilidade, mas o escopo agora é global
  players?: any[];
  myClub: any | null;
  scoutReports: Record<string, ScoutReport>;
  onReportCreated: (report: ScoutReport, novoUsado: number) => void;
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

  const [clubsMap, setClubsMap] = useState<Record<string, string>>({});

  // Carrega os nomes de todos os clubes para exibir na tabela
  useEffect(() => {
    const fetchClubs = async () => {
      const { data } = await supabase.from("clubs").select("id, name");
      if (data) {
        const map: Record<string, string> = {};
        data.forEach((c) => (map[c.id] = c.name));
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
      // 1. Query para os jogadores profissionais
      // ATENÇÃO: Troque 'overall' pelo nome correto da coluna de habilidade na sua tabela 'players'
      let pQuery = supabase.from("players").select("id, name, position, age, overall, nationality, club_id");
      if (searchTerm) pQuery = pQuery.ilike("name", `%${searchTerm}%`);
      if (positionFilter !== "todas") pQuery = pQuery.eq("position", positionFilter);
      if (ageMin) pQuery = pQuery.gte("age", parseInt(ageMin) || 0);
      if (ageMax) pQuery = pQuery.lte("age", parseInt(ageMax) || 99);
      if (myClub) pQuery = pQuery.neq("club_id", myClub.id);

      // 2. Query para os jogadores da base (aqui sabemos que a coluna se chama 'skill')
      let aQuery = supabase.from("academy_players").select("id, name, position, age, skill, nationality, club_id");
      if (searchTerm) aQuery = aQuery.ilike("name", `%${searchTerm}%`);
      if (positionFilter !== "todas") aQuery = aQuery.eq("position", positionFilter);
      if (ageMin) aQuery = aQuery.gte("age", parseInt(ageMin) || 0);
      if (ageMax) aQuery = aQuery.lte("age", parseInt(ageMax) || 99);
      if (myClub) aQuery = aQuery.neq("club_id", myClub.id);

      const [pRes, aRes] = await Promise.all([pQuery, aQuery]);

      if (pRes.error) throw pRes.error;
      if (aRes.error) throw aRes.error;

      // Junta os resultados identificando a origem de cada um
      const combined = [
        // Mapeamos a coluna do profissional (ex: p.overall) para 'skill' para que o componente SkillDisplay funcione
        ...(pRes.data || []).map((p: any) => ({ ...p, skill: p.overall, source: "Profissional" })),
        ...(aRes.data || []).map((p: any) => ({ ...p, source: "Base" })),
      ];

      // Ordena por habilidade decrescente
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
      // Define qual a função do Supabase chamar dependendo de onde o jogador está
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
  const limite = 10; // Caso queira tornar dinâmico depois, você altera aqui
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

      {/* PAINEL DE FILTROS */}
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

      {/* TABELA DE RESULTADOS */}
      {hasSearched && (
        <Card className="overflow-hidden border-border/50">
          <Table>
            <TableHeader className="bg-secondary/40">
              <TableRow>
                <TableHead>Jogador</TableHead>
                <TableHead className="text-center">Clube / Origem</TableHead>
                <TableHead className="text-center w-16">Pos</TableHead>
                <TableHead className="text-center w-16">Idade</TableHead>
                <TableHead className="text-center w-32">Hab.</TableHead>
                <TableHead className="text-right w-44">Potencial</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum jogador encontrado com estes filtros.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((p) => {
                  const rep = scoutReports[p.id];
                  return (
                    <TableRow key={`${p.id}-${p.source}`} className="hover:bg-primary/5 transition-colors">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="truncate max-w-[180px]">{p.name}</span>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1 truncate max-w-[120px]">
                            <Shield className="h-3 w-3" />
                            {clubsMap[p.club_id] || "Sem Clube"}
                          </span>
                          <Badge
                            variant={p.source === "Base" ? "outline" : "secondary"}
                            className="text-[9px] h-4 leading-none py-0"
                          >
                            {p.source}
                          </Badge>
                        </div>
                      </TableCell>

                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] font-bold">
                          {p.position}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-center text-xs tabular-nums">{p.age}a</TableCell>

                      <TableCell className="text-center">
                        {/* Como não temos o rate da base de todos os clubes facilmente, passamos undefined para que exiba a força bruta */}
                        <SkillDisplay value={p.skill} rate={undefined} kind="skill" />
                      </TableCell>

                      <TableCell className="text-right">
                        {rep ? (
                          <div className="flex justify-end" title={`Margem: ±${rep.margem_aplicada || "?"}`}>
                            <SkillDisplay
                              value={rep.potential_max_revelado}
                              valueMin={rep.potential_min_revelado}
                              rate={undefined}
                              kind="potential"
                              numericLabel={`${rep.potential_min_revelado}-${rep.potential_max_revelado}`}
                            />
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                            <div className="flex items-center gap-0.5 text-muted-foreground/40 hidden sm:flex">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star key={i} style={{ width: 14, height: 14 }} />
                              ))}
                            </div>
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
                          </div>
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
