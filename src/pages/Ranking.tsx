import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Shield, Users, TrendingUp, ArrowUpDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeason } from "@/contexts/SeasonContext";

type Row = {
  id: string;
  name: string;
  crest_url: string | null;
  budget: number;
  stadium_capacity: number;
  city: string | null;
  rate: number;
  reputacao: string | null;
  nivel_estadio: number;
  nivel_base: number;
  posicao_ultima_temporada: number | null;
  player_count: number;
  folha_salarial: number;
  patrocinios: number;
  valor_elenco: number;
  media_habilidade: number;
  media_idade: number;
};

type SortKey =
  | "name" | "budget" | "rate" | "reputacao"
  | "folha_salarial" | "patrocinios" | "valor_elenco"
  | "posicao_ultima_temporada" | "nivel_estadio" | "nivel_base"
  | "player_count" | "media_habilidade" | "media_idade";

const SORT_OPTIONS: { value: SortKey; label: string; group: string; numeric: boolean; ascDefault?: boolean }[] = [
  { value: "name", label: "Nome (A-Z)", group: "Básicas", numeric: false, ascDefault: true },
  { value: "budget", label: "Maior orçamento", group: "Básicas", numeric: true },
  { value: "rate", label: "Maior rate", group: "Básicas", numeric: true },
  { value: "reputacao", label: "Reputação", group: "Básicas", numeric: false },
  { value: "folha_salarial", label: "Maior folha salarial", group: "Financeiras", numeric: true },
  { value: "patrocinios", label: "Maiores patrocínios", group: "Financeiras", numeric: true },
  { value: "valor_elenco", label: "Valor do elenco", group: "Financeiras", numeric: true },
  { value: "posicao_ultima_temporada", label: "Posição (última temp.)", group: "Esportivas", numeric: true, ascDefault: true },
  { value: "nivel_estadio", label: "Nível do estádio", group: "Esportivas", numeric: true },
  { value: "nivel_base", label: "Nível das categorias de base", group: "Esportivas", numeric: true },
  { value: "player_count", label: "Nº de jogadores", group: "Elenco", numeric: true },
  { value: "media_habilidade", label: "Média de habilidade", group: "Elenco", numeric: true },
  { value: "media_idade", label: "Média de idade", group: "Elenco", numeric: true, ascDefault: true },
];

const REP_RANK: Record<string, number> = { mundial: 5, continental: 4, nacional: 3, estadual: 2, local: 1 };

const Ranking = () => {
  const { currentSeason } = useSeason();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("budget");
  const [asc, setAsc] = useState(false);

  useEffect(() => {
    document.title = "Ranking — Solara Hub";
    const load = async () => {
      const [{ data: clubsData }, { data: playersData }, { data: contratos }] = await Promise.all([
        supabase.from("clubs").select("*"),
        supabase.from("players").select("club_id, salario_atual, valor_base_calculado, habilidade, age"),
        supabase.from("contratos_clube").select("club_id, valor_anual, ativo"),
      ]);

      const playersByClub = new Map<string, any[]>();
      playersData?.forEach((p) => {
        if (!p.club_id) return;
        if (!playersByClub.has(p.club_id)) playersByClub.set(p.club_id, []);
        playersByClub.get(p.club_id)!.push(p);
      });

      const patBy = new Map<string, number>();
      contratos?.forEach((c: any) => {
        if (!c.ativo || !c.club_id) return;
        patBy.set(c.club_id, (patBy.get(c.club_id) || 0) + Number(c.valor_anual || 0));
      });

      const out: Row[] = (clubsData || []).map((c: any) => {
        const pls = playersByClub.get(c.id) || [];
        const folha = pls.reduce((s, p) => s + Number(p.salario_atual || 0), 0);
        const valor = pls.reduce((s, p) => s + Number(p.valor_base_calculado || 0), 0);
        const habs = pls.filter(p => p.habilidade != null).map(p => Number(p.habilidade));
        const ages = pls.filter(p => p.age != null).map(p => Number(p.age));
        return {
          id: c.id,
          name: c.name,
          crest_url: c.crest_url,
          budget: Number(c.budget || 0),
          stadium_capacity: c.stadium_capacity || 0,
          city: c.city,
          rate: Number(c.rate || 0),
          reputacao: c.reputacao,
          nivel_estadio: c.nivel_estadio || 0,
          nivel_base: c.nivel_base || 0,
          posicao_ultima_temporada: c.posicao_ultima_temporada,
          player_count: pls.length,
          folha_salarial: folha,
          patrocinios: patBy.get(c.id) || 0,
          valor_elenco: valor,
          media_habilidade: habs.length ? habs.reduce((a, b) => a + b, 0) / habs.length : 0,
          media_idade: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
        };
      });

      setRows(out);
      setLoading(false);
    };
    load();
  }, []);

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a: any, b: any) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      let cmp: number;
      if (sortKey === "reputacao") {
        cmp = (REP_RANK[(av || "").toString().toLowerCase()] || 0) - (REP_RANK[(bv || "").toString().toLowerCase()] || 0);
      } else if (sortKey === "posicao_ultima_temporada") {
        // null por último
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = 1;
        else if (bv == null) cmp = -1;
        else cmp = av - bv;
        return asc ? cmp : -cmp; // asc = melhor posição (1) primeiro
      } else if (typeof av === "number") {
        cmp = av - bv;
      } else {
        cmp = String(av || "").localeCompare(String(bv || ""), "pt-BR");
      }
      return asc ? cmp : -cmp;
    });
    return arr;
  }, [rows, sortKey, asc]);

  const totalBudget = rows.reduce((s, c) => s + c.budget, 0);
  const totalCapacity = rows.reduce((s, c) => s + c.stadium_capacity, 0);

  const onSortChange = (v: SortKey) => {
    const opt = SORT_OPTIONS.find(o => o.value === v);
    setSortKey(v);
    setAsc(opt?.ascDefault ?? false);
  };

  const formatValue = (r: Row): string => {
    switch (sortKey) {
      case "name": return r.city || "—";
      case "budget": return formatCurrency(r.budget);
      case "rate": return r.rate.toFixed(2);
      case "reputacao": return r.reputacao || "—";
      case "folha_salarial": return formatCurrency(r.folha_salarial);
      case "patrocinios": return formatCurrency(r.patrocinios);
      case "valor_elenco": return formatCurrency(r.valor_elenco);
      case "posicao_ultima_temporada": return r.posicao_ultima_temporada ? `${r.posicao_ultima_temporada}º` : "—";
      case "nivel_estadio": return `Nv. ${r.nivel_estadio}`;
      case "nivel_base": return `Nv. ${r.nivel_base}`;
      case "player_count": return `${r.player_count} jog.`;
      case "media_habilidade": return r.media_habilidade.toFixed(1);
      case "media_idade": return `${r.media_idade.toFixed(1)} anos`;
    }
  };

  const groups = useMemo(() => {
    const g: Record<string, typeof SORT_OPTIONS> = {};
    SORT_OPTIONS.forEach(o => { (g[o.group] ||= []).push(o); });
    return g;
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <header className="space-y-3">
        <Badge variant="outline" className="border-primary/40 text-primary">{currentSeason || "Temporada Ativa"}</Badge>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold">
          Ranking de <span className="gold-text">Clubes</span>
        </h1>
        <p className="text-muted-foreground text-base sm:text-lg max-w-2xl">
          Ordene por qualquer categoria — financeira, esportiva ou de elenco.
        </p>
      </header>

      <div className="stat-grid">
        <StatCard icon={Shield} label="Clubes" value={formatNumber(rows.length)} />
        <StatCard icon={Users} label="Capacidade Total" value={formatNumber(totalCapacity)} />
        <StatCard icon={TrendingUp} label="Capital em Jogo" value={formatCurrency(totalBudget)} />
        <StatCard icon={Trophy} label="Líder" value={sortedRows[0]?.name || "—"} />
      </div>

      <section>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6 text-primary" /> Ranking
          </h2>
          <div className="flex items-center gap-2">
            <Select value={sortKey} onValueChange={(v) => onSortChange(v as SortKey)}>
              <SelectTrigger className="w-[260px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(groups).map(([group, opts]) => (
                  <div key={group}>
                    <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{group}</div>
                    {opts.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => setAsc(a => !a)} title={asc ? "Crescente" : "Decrescente"}>
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
        ) : sortedRows.length === 0 ? (
          <Card className="p-12 text-center bg-gradient-card border-border/50">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">Nenhum clube cadastrado ainda.</p>
          </Card>
        ) : (
          <div className="grid gap-3">
            {sortedRows.map((club, idx) => (
              <Link key={club.id} to={`/clubes/${club.id}`}>
                <Card className="p-3 sm:p-4 bg-gradient-card border-border/50 hover:border-primary/50 hover:shadow-gold transition-all hover:translate-x-1 cursor-pointer group">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className={`text-xl sm:text-2xl font-display font-bold w-8 sm:w-10 text-center shrink-0 ${idx < 3 ? "gold-text" : "text-muted-foreground"}`}>
                      {String(idx + 1).padStart(2, "0")}
                    </div>
                    <div className="h-10 w-10 sm:h-14 sm:w-14 flex items-center justify-center shrink-0">
                      {club.crest_url ? (
                        <img src={club.crest_url} alt={club.name} className="h-full w-full object-contain" />
                      ) : (
                        <Shield className="h-6 w-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm sm:text-lg truncate group-hover:text-primary transition-colors">{club.name}</div>
                      <div className="text-[11px] sm:text-xs text-muted-foreground truncate">
                        {club.city || "—"} · {club.player_count} jogadores · Rate {club.rate.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        {SORT_OPTIONS.find(o => o.value === sortKey)?.label}
                      </div>
                      <div className="font-display font-bold text-primary text-sm sm:text-base">{formatValue(club)}</div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value }: { icon: any; label: string; value: string }) => (
  <Card className="p-5 bg-gradient-card border-border/50">
    <div className="flex items-center gap-3">
      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-5 w-5 text-primary" />
      </div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display font-bold text-lg truncate">{value}</div>
      </div>
    </div>
  </Card>
);

export default Ranking;
