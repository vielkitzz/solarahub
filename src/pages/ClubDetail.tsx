import { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Shield,
  MapPin,
  Users,
  Wallet,
  Building2,
  TrendingUp,
  TrendingDown,
  Save,
  Tag,
  AlertTriangle,
  FileSignature,
  Search,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { ContractRenewalDialog } from "@/components/ContractRenewalDialog";
import { formatCurrency, POSITIONS, calcStars } from "@/lib/format";
import { StarRating } from "@/components/StarRating";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichEditor } from "@/components/RichEditor";
import { WikiSectionsView, WikiData, WikiSectionKey } from "@/components/WikiSections";
import { ClubInfobox, InfoboxData } from "@/components/ClubInfobox";
import { ContractsManager } from "@/components/ContractsManager";
import { StadiumManager } from "@/components/StadiumManager";
import { AcademyManager } from "@/components/AcademyManager";
import { ImageUpload } from "@/components/ImageUpload";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { getFlagUrl } from "@/lib/countries";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "elenco";
  const { user, isAdmin } = useAuth();
  const [club, setClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [contratosTotal, setContratosTotal] = useState(0);
  const [temporadaAtual, setTemporadaAtual] = useState<number>(2020);
  const [renewPlayer, setRenewPlayer] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [wikiData, setWikiData] = useState<WikiData>({});
  const [editingClub, setEditingClub] = useState<any>(null);
  const [masterSponsor, setMasterSponsor] = useState<string | null>(null);
  const [kitSupplier, setKitSupplier] = useState<string | null>(null);

  // Apenas o dono do clube pode editar pela página do clube. Admins editam pelo painel /admin.
  const canEdit = !!user && !!club && club.owner_id === user.id;
  const [ownerInfo, setOwnerInfo] = useState<{ display_name: string | null; avatar_url: string | null } | null>(null);

  const [direitosTv, setDireitosTv] = useState<number>(0);
  const [imgSettings, setImgSettings] = useState<{ custo_pct: number; receita_pct: number }>({
    custo_pct: 0.03,
    receita_pct: 0.5,
  });

  const load = async () => {
    if (!id) return;
    const [
      { data: c },
      { data: p },
      { data: ct },
      { data: settings },
      { data: masterContract },
      { data: kitContract },
      { data: tvRightsValue },
    ] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", id).maybeSingle(),
      supabase.from("players").select("*").eq("club_id", id),
      supabase.from("contratos_clube").select("valor_anual").eq("club_id", id).eq("ativo", true),
      supabase.from("settings").select("key, value").in("key", ["temporada_atual", "direitos_imagem"]),
      supabase
        .from("contratos_clube")
        .select("empresa_nome, categoria")
        .eq("club_id", id)
        .eq("ativo", true)
        .in("categoria", ["master", "patrocinio_master"])
        .limit(1)
        .maybeSingle(),
      supabase
        .from("contratos_clube")
        .select("empresa_nome, categoria")
        .eq("club_id", id)
        .eq("ativo", true)
        .eq("categoria", "fornecedora")
        .limit(1)
        .maybeSingle(),
      supabase.rpc("get_tv_rights_value", { _club_id: id }),
    ]);

    setClub(c);
    setMasterSponsor((masterContract as any)?.empresa_nome ?? null);
    setKitSupplier((kitContract as any)?.empresa_nome ?? null);
    setPlayers(p || []);
    setContratosTotal((ct || []).reduce((s, r: any) => s + Number(r.valor_anual || 0), 0));

    (settings || []).forEach((s: any) => {
      if (s.key === "temporada_atual" && typeof s.value?.ano === "number") setTemporadaAtual(s.value.ano);
      if (s.key === "direitos_imagem")
        setImgSettings({
          custo_pct: Number(s.value?.custo_pct ?? 0.03),
          receita_pct: Number(s.value?.receita_pct ?? 0.5),
        });
    });

    setDireitosTv(Number(tvRightsValue || 0));
    setWikiData((c?.wiki as WikiData) || {});
    setEditingClub(c);
    setLoading(false);
    if (c) document.title = `${c.name} — Solara Hub`;
  };

  useEffect(() => {
    load();
  }, [id]);

  // Carrega informação do dono (nome + avatar) quando o clube é carregado
  useEffect(() => {
    const loadOwner = async () => {
      if (!club?.owner_id) {
        setOwnerInfo(null);
        return;
      }
      const { data } = await supabase.rpc("get_owner_display_info", { _user_id: club.owner_id });
      const row = Array.isArray(data) ? data[0] : data;
      setOwnerInfo(row ? { display_name: row.display_name ?? null, avatar_url: row.avatar_url ?? null } : null);
    };
    loadOwner();
  }, [club?.owner_id]);

  const saveWiki = async (next: WikiData) => {
    setWikiData(next);
    const { error } = await supabase
      .from("clubs")
      .update({ wiki: next as any })
      .eq("id", id!);
    if (error) toast.error(error.message);
    else toast.success("Wiki atualizada!");
  };

  const saveSection = async (key: WikiSectionKey, html: string) => {
    const next: WikiData = {
      ...wikiData,
      sections: { ...(wikiData.sections ?? {}), [key]: html },
    };
    await saveWiki(next);
  };

  const saveInfobox = async (next: InfoboxData) => {
    // Patrocinador e material são sempre derivados dos contratos ativos — nunca editáveis manualmente
    const synced: InfoboxData = {
      ...next,
      patrocinador: masterSponsor ?? next.patrocinador,
      material: kitSupplier ?? next.material,
    };
    await saveWiki({ ...wikiData, infobox: synced });
  };

  const saveClubInfo = async () => {
    const { error } = await supabase
      .from("clubs")
      .update({
        name: editingClub.name,
        crest_url: editingClub.crest_url,
        city: editingClub.city,
        stadium_name: editingClub.stadium_name,
        primary_color: editingClub.primary_color,
        founded_year: parseInt(editingClub.founded_year) || null,
      })
      .eq("id", id!);
    if (error) toast.error(error.message);
    else {
      toast.success("Clube atualizado!");
      load();
    }
  };

  const toggleSale = async (playerId: string, value: boolean) => {
    const { error } = await supabase.from("players").update({ a_venda: value }).eq("id", playerId);
    if (error) return toast.error(error.message);
    setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, a_venda: value } : p)));
    toast.success(value ? "Jogador colocado à venda" : "Jogador removido da vitrine");
  };

  if (loading)
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-80" />
      </div>
    );
  if (!club) return <div className="text-center py-20 text-muted-foreground">Clube não encontrado.</div>;

  const folhaSalarial = players.reduce((s, p) => s + Number(p.salario_atual || 0), 0);
  const valorBaseFolha = players.reduce((s, p) => s + Number(p.valor_base_calculado || 0), 0);
  const premiacaoPorPosicao = (pos: number | null | undefined) => {
    if (!pos) return 0;
    if (pos === 1) return 20_000_000;
    if (pos === 2) return 12_000_000;
    if (pos === 3) return 8_000_000;
    if (pos === 4) return 5_000_000;
    if (pos <= 8) return 3_000_000;
    if (pos <= 12) return 1_500_000;
    if (pos <= 16) return 750_000;
    if (pos <= 20) return 300_000;
    return 0;
  };
  const premiacao = premiacaoPorPosicao(club.posicao_ultima_temporada);
  const manutencao = (club.nivel_base || 1) * 300_000;
  // Direitos de imagem
  const direitosImagemCusto = valorBaseFolha * imgSettings.custo_pct;
  const direitosImagemReceita = direitosImagemCusto * imgSettings.receita_pct;
  // Bilheteria estimada (mantém fórmula simples para o resumo)
  const cap = Number(club.stadium_capacity || 0);
  const ocNac = Math.max(0.3, Math.min(1, 1 - ((Number(club.preco_ingresso_nacional || 15) - 5) / 25) * 0.5));
  const ocInt = Math.max(0.3, Math.min(1, 1 - ((Number(club.preco_ingresso_internacional || 25) - 10) / 40) * 0.5));
  const recPorJogo =
    (cap * ocNac * Number(club.preco_ingresso_nacional || 15) +
      cap * ocInt * Number(club.preco_ingresso_internacional || 25)) /
    2;
  const bilheteria = recPorJogo * Number(club.jogos_por_temporada || 38);
  const entradasAnuais = contratosTotal + direitosTv + direitosImagemReceita + premiacao + bilheteria;
  const saidasAnuais = folhaSalarial + manutencao + direitosImagemCusto;
  const saldoPrevisto = entradasAnuais - saidasAnuais;
  const entradasMensais = entradasAnuais / 12;
  const saidasMensais = saidasAnuais / 12;
  const exigClube = club.rate; // usado na fórmula calcStars

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <Card className="p-4 sm:p-6 md:p-8 bg-gradient-card border-border/50 overflow-hidden relative">
        <div
          className="absolute inset-0 opacity-20"
          style={
            club.primary_color
              ? { background: `radial-gradient(circle at top right, ${club.primary_color}, transparent 60%)` }
              : undefined
          }
        />
        <div className="relative flex flex-col md:flex-row gap-4 md:gap-6 items-start md:items-center">
          <div className="flex items-start gap-4 w-full md:w-auto">
            <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-32 md:w-32 flex items-center justify-center shrink-0">
              {club.crest_url ? (
                <img
                  src={club.crest_url}
                  alt={club.name}
                  className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                />
              ) : (
                <Shield className="h-10 w-10 md:h-14 md:w-14 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0 md:hidden">
              <h1 className="text-xl sm:text-2xl font-bold leading-tight break-words">{club.name}</h1>
              <div className="text-[10px] uppercase text-muted-foreground tracking-wider mt-2">Caixa Atual</div>
              <div className="text-xl font-display font-bold gold-text">{formatCurrency(Number(club.budget))}</div>
            </div>
          </div>
          <div className="flex-1 min-w-0 space-y-2 w-full">
            <div className="flex items-center gap-2 flex-wrap">
              {club.owner_id ? (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/60 border border-border/50 pl-1 pr-2.5 py-0.5">
                  <Avatar className="h-5 w-5 ring-1 ring-primary/30">
                    <AvatarImage src={ownerInfo?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px] bg-secondary">
                      {(ownerInfo?.display_name ?? "?").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-[10px] font-semibold text-foreground/90 max-w-[140px] truncate">
                    {ownerInfo?.display_name ?? "Dono"}
                  </span>
                </div>
              ) : (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  Sem dono
                </Badge>
              )}
              {club.founded_year && (
                <Badge variant="outline" className="text-[10px]">
                  Fundado em {club.founded_year}
                </Badge>
              )}
              {club.reputacao && (
                <Badge variant="outline" className="capitalize text-[10px]">
                  {club.reputacao}
                </Badge>
              )}
              <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                Rate {Number(club.rate ?? 2.8).toFixed(2)}
              </Badge>
            </div>
            <h1 className="hidden md:block text-3xl md:text-5xl font-bold break-words">{club.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-muted-foreground">
              {club.city && (
                <span className="flex items-center gap-1 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{club.city}</span>
                </span>
              )}
              {club.stadium_name && (
                <span className="flex items-center gap-1 min-w-0">
                  <Building2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{club.stadium_name}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5 shrink-0" /> {players.length} jogadores
              </span>
            </div>
          </div>
          <div className="hidden md:block text-right shrink-0">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Caixa Atual</div>
            <div className="text-3xl md:text-4xl font-display font-bold gold-text">
              {formatCurrency(Number(club.budget))}
            </div>
          </div>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard icon={Wallet} label="Entradas / mês" value={formatCurrency(entradasMensais)} positive />
        <StatCard icon={TrendingDown} label="Saídas / mês" value={formatCurrency(saidasMensais)} />
        <StatCard
          icon={TrendingUp}
          label="Lucro/Prejuízo previsto"
          value={formatCurrency(saldoPrevisto)}
          positive={saldoPrevisto >= 0}
        />
        <StatCard icon={Users} label="Folha salarial" value={formatCurrency(folhaSalarial)} />
      </div>

      <Tabs
        value={initialTab}
        onValueChange={(v) => {
          const sp = new URLSearchParams(searchParams);
          if (v === "elenco") sp.delete("tab");
          else sp.set("tab", v);
          setSearchParams(sp, { replace: true });
        }}
        className="w-full"
      >
        <div className="-mx-3 sm:-mx-4 md:mx-0 overflow-x-auto scrollbar-thin">
          <TabsList className="bg-secondary/50 mx-3 sm:mx-4 md:mx-0 w-max">
            <TabsTrigger value="elenco">Elenco</TabsTrigger>
            <TabsTrigger value="financas">Finanças</TabsTrigger>
            <TabsTrigger value="estadio">Estádio</TabsTrigger>
            <TabsTrigger value="base">Base</TabsTrigger>
            <TabsTrigger value="wiki">Wiki</TabsTrigger>
            {canEdit && <TabsTrigger value="config">Configurações</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="elenco" className="mt-4">
          {players.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
              Sem jogadores no elenco.
            </Card>
          ) : (
            <SquadTable
              players={players}
              club={club}
              canEdit={canEdit}
              temporadaAtual={temporadaAtual}
              toggleSale={toggleSale}
              setRenewPlayer={setRenewPlayer}
            />
          )}
        </TabsContent>

        <TabsContent value="financas" className="space-y-4 mt-4">
          {/* Cards-resumo */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas mensais</div>
              <div className="font-display font-bold text-success mt-1">{formatCurrency(entradasMensais)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(entradasAnuais)} / ano</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas mensais</div>
              <div className="font-display font-bold text-destructive mt-1">{formatCurrency(saidasMensais)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{formatCurrency(saidasAnuais)} / ano</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Lucro/Prejuízo previsto</div>
              <div
                className={`font-display font-bold mt-1 ${saldoPrevisto >= 0 ? "text-success" : "text-destructive"}`}
              >
                {formatCurrency(saldoPrevisto)}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5">por temporada</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Caixa atual</div>
              <div className="font-display font-bold gold-text mt-1">{formatCurrency(Number(club.budget))}</div>
            </Card>
          </div>

          {/* Detalhamento de receitas e despesas */}
          <div className="grid md:grid-cols-2 gap-3">
            <Card className="p-4 bg-gradient-card border-border/50 space-y-2">
              <h4 className="font-display font-bold text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-success" /> Receitas anuais
              </h4>
              <div className="text-sm space-y-1">
                <Row label="Patrocínios" value={contratosTotal} positive />
                <Row label="Direitos de TV" value={direitosTv} positive />
                <Row label="Direitos de imagem" value={direitosImagemReceita} positive />
                <Row label="Bilheteria estimada" value={bilheteria} positive />
                <Row label="Premiação por posição" value={premiacao} positive />
                <hr className="border-border/40" />
                <Row label="Total" value={entradasAnuais} positive bold />
              </div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50 space-y-2">
              <h4 className="font-display font-bold text-sm flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-destructive" /> Despesas anuais
              </h4>
              <div className="text-sm space-y-1">
                <Row label="Folha salarial" value={folhaSalarial} />
                <Row label="Direitos de imagem (custo)" value={direitosImagemCusto} />
                <Row label="Manutenção da base" value={manutencao} />
                <hr className="border-border/40" />
                <Row label="Total" value={saidasAnuais} bold />
              </div>
            </Card>
          </div>

          {/* Contratos: patrocínios + TV + imagem */}
          <ContractsManager
            clubId={id!}
            canEdit={canEdit}
            reputacao={club.reputacao}
            valorBaseFolha={valorBaseFolha}
            onChange={load}
          />
        </TabsContent>

        <TabsContent value="estadio" className="mt-4">
          <StadiumManager club={club} canEdit={canEdit} onChange={load} />
        </TabsContent>

        <TabsContent value="base" className="mt-4">
          <AcademyManager club={club} canEdit={canEdit} onChange={load} />
        </TabsContent>

        <TabsContent value="wiki" className="mt-4">
          <div className="flex flex-col md:flex-row-reverse gap-6 items-start">
            <ClubInfobox
              club={club}
              infobox={(wikiData.infobox as InfoboxData) || {}}
              canEdit={canEdit}
              onSave={saveInfobox}
            />
            <div className="flex-1 min-w-0 w-full">
              <WikiSectionsView wiki={wikiData} title={club.name} canEdit={canEdit} onSaveSection={saveSection} />
            </div>
          </div>
        </TabsContent>

        {canEdit && (
          <TabsContent value="config" className="mt-4">
            <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
              <h3 className="font-display font-bold">Editar Informações</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input
                    value={editingClub?.name || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })}
                  />
                </div>
                <div className="md:col-span-1">
                  <Label>Escudo</Label>
                  <ImageUpload
                    value={editingClub?.crest_url}
                    onChange={(url) => setEditingClub({ ...editingClub, crest_url: url })}
                    folder={id}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={editingClub?.city || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estádio</Label>
                  <Input
                    value={editingClub?.stadium_name || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, stadium_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor primária (hex)</Label>
                  <Input
                    value={editingClub?.primary_color || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, primary_color: e.target.value })}
                    placeholder="#ffbe1a"
                  />
                </div>
                <div>
                  <Label>Ano de fundação</Label>
                  <Input
                    type="number"
                    value={editingClub?.founded_year || ""}
                    onChange={(e) => setEditingClub({ ...editingClub, founded_year: e.target.value })}
                  />
                </div>
              </div>
              <Button onClick={saveClubInfo} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                <Save className="h-4 w-4" /> Salvar
              </Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {renewPlayer && (
        <ContractRenewalDialog
          player={renewPlayer}
          open={!!renewPlayer}
          onOpenChange={(v) => !v && setRenewPlayer(null)}
          onRenewed={() => {
            setRenewPlayer(null);
            load();
          }}
        />
      )}
    </div>
  );
};

// ─── Squad Table ──────────────────────────────────────────────────────────────

// Cor individual por posição
const POSITION_COLORS: Record<string, { color: string; bg: string }> = {
  GOL: { color: "text-yellow-300", bg: "bg-yellow-400/20 border-yellow-400/50" },
  ZAG: { color: "text-blue-300", bg: "bg-blue-500/20 border-blue-400/50" },
  LD: { color: "text-sky-300", bg: "bg-sky-500/20 border-sky-400/50" },
  LE: { color: "text-sky-300", bg: "bg-sky-500/20 border-sky-400/50" },
  VOL: { color: "text-teal-300", bg: "bg-teal-500/20 border-teal-400/50" },
  MC: { color: "text-emerald-300", bg: "bg-emerald-500/20 border-emerald-400/50" },
  MEI: { color: "text-lime-300", bg: "bg-lime-500/20 border-lime-400/50" },
  PD: { color: "text-orange-300", bg: "bg-orange-500/20 border-orange-400/50" },
  PE: { color: "text-orange-300", bg: "bg-orange-500/20 border-orange-400/50" },
  SA: { color: "text-red-300", bg: "bg-red-500/20 border-red-400/50" },
  ATA: { color: "text-rose-300", bg: "bg-rose-500/20 border-rose-400/50" },
};

function getPositionStyle(position: string) {
  return (
    POSITION_COLORS[(position || "").toUpperCase()] ?? {
      color: "text-muted-foreground",
      bg: "bg-secondary/30 border-border/30",
    }
  );
}

function ContractBadge({ contrato_ate, temporadaAtual }: { contrato_ate: number | null; temporadaAtual: number }) {
  if (!contrato_ate) return <span className="text-xs text-muted-foreground">—</span>;
  const anos = contrato_ate - temporadaAtual;
  const expirando = anos <= 1;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${
        expirando ? "border-destructive/50 text-destructive bg-destructive/5" : "border-border/40 text-muted-foreground"
      }`}
    >
      {expirando && <AlertTriangle className="h-2.5 w-2.5" />}
      {contrato_ate}
    </span>
  );
}

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

function SquadTable({
  players,
  club,
  canEdit,
  temporadaAtual,
  toggleSale,
  setRenewPlayer,
}: {
  players: any[];
  club: any;
  canEdit: boolean;
  temporadaAtual: number;
  toggleSale: (id: string, v: boolean) => void;
  setRenewPlayer: (p: any) => void;
}) {
  // ESTADOS
  const [searchTerm, setSearchTerm] = useState("");
  const [positionFilter, setPositionFilter] = useState("todas");
  const [statusFilter, setStatusFilter] = useState("todos");

  // ESTADO DE ORDENAÇÃO (Qual coluna e qual direção)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: "asc" | "desc" } | null>({
    key: "posicao",
    direction: "asc",
  });

  // FUNÇÃO PARA MUDAR A ORDENAÇÃO AO CLICAR NO CABEÇALHO
  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (sortConfig && sortConfig.key === key && sortConfig.direction === "asc") {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  // FUNÇÃO PARA RENDERIZAR O ÍCONE DA SETINHA NO CABEÇALHO
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="h-3 w-3 opacity-20 shrink-0" />;
    return sortConfig.direction === "asc" ? (
      <ChevronUp className="h-3 w-3 shrink-0" />
    ) : (
      <ChevronDown className="h-3 w-3 shrink-0" />
    );
  };

  // FILTRAGEM E ORDENAÇÃO
  const filteredAndSorted = useMemo(() => {
    return players
      .filter((p) => {
        if (searchTerm && !p.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        if (positionFilter !== "todas" && p.position !== positionFilter) return false;
        if (statusFilter === "venda" && !p.a_venda) return false;
        if (statusFilter === "expirando") {
          const expirando =
            p.contrato_ate !== null && p.contrato_ate !== undefined && p.contrato_ate - temporadaAtual <= 1;
          if (!expirando) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        const modifier = direction === "asc" ? 1 : -1;

        switch (key) {
          case "numero":
            return (Number(a.attributes?.shirtNumber || 999) - Number(b.attributes?.shirtNumber || 999)) * modifier;
          case "nome":
            return a.name.localeCompare(b.name) * modifier;
          case "posicao":
            const ai = POSITIONS.indexOf(a.position);
            const bi = POSITIONS.indexOf(b.position);
            const av = ai === -1 ? 999 : ai;
            const bv = bi === -1 ? 999 : bi;
            if (av !== bv) return (av - bv) * modifier;
            return (Number(b.market_value || 0) - Number(a.market_value || 0)) * modifier;
          case "nacionalidade":
            return (a.nationality || "").localeCompare(b.nationality || "") * modifier;
          case "idade":
            return (Number(a.age || 0) - Number(b.age || 0)) * modifier;
          case "qualidade":
            return (Number(a.habilidade || 0) - Number(b.habilidade || 0)) * modifier;
          case "potencial":
            return (Number(a.potential_max || 0) - Number(b.potential_max || 0)) * modifier;
          case "valor":
            return (Number(a.market_value || 0) - Number(b.market_value || 0)) * modifier;
          case "salario":
            return (Number(a.salario_atual || 0) - Number(b.salario_atual || 0)) * modifier;
          case "contrato":
            return (Number(a.contrato_ate || 0) - Number(b.contrato_ate || 0)) * modifier;
          default:
            return 0;
        }
      });
  }, [players, searchTerm, positionFilter, statusFilter, sortConfig, temporadaAtual]);

  return (
    <div className="space-y-0 rounded-lg overflow-hidden border border-border/50 bg-gradient-card">
      <div className="flex items-center gap-4 px-4 py-2.5 bg-secondary/40 border-b border-border/50 text-xs text-muted-foreground flex-wrap">
        <span className="font-semibold text-foreground">{filteredAndSorted.length} jogadores listados</span>
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          <span>
            Folha:{" "}
            <span className="text-foreground">
              {formatCurrency(filteredAndSorted.reduce((s, p) => s + Number(p.salario_atual || 0), 0))}
            </span>
          </span>
          <span>
            Valor total:{" "}
            <span className="text-foreground">
              {formatCurrency(filteredAndSorted.reduce((s, p) => s + Number(p.market_value || 0), 0))}
            </span>
          </span>
        </div>
      </div>

      {/* BARRA DE FILTROS (Sem o dropdown de ordenar) */}
      <div className="p-3 bg-secondary/10 border-b border-border/50 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pelo nome..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-xs bg-background/50"
          />
        </div>

        <Select value={positionFilter} onValueChange={setPositionFilter}>
          <SelectTrigger className="h-9 text-xs bg-background/50">
            <SelectValue placeholder="Todas as posições" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as posições</SelectItem>
            {POSITIONS.map((pos) => (
              <SelectItem key={pos} value={pos}>
                {pos}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 text-xs bg-background/50">
            <SelectValue placeholder="Qualquer status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer status</SelectItem>
            <SelectItem value="venda">Apenas à venda</SelectItem>
            <SelectItem value="expirando">Contratos expirando</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/50 bg-secondary/20">
              <TableHead
                className="w-12 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("numero")}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  # <SortIcon columnKey="numero" />
                </div>
              </TableHead>

              <TableHead
                className="w-16 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("posicao")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Posição <SortIcon columnKey="posicao" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("nome")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Nome <SortIcon columnKey="nome" />
                </div>
              </TableHead>

              <TableHead
                className="w-20 hidden sm:table-cell cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("nacionalidade")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Nacionalidade <SortIcon columnKey="nacionalidade" />
                </div>
              </TableHead>

              <TableHead
                className="w-16 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("idade")}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Idade <SortIcon columnKey="idade" />
                </div>
              </TableHead>

              <TableHead
                className="w-28 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("qualidade")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Qualidade <SortIcon columnKey="qualidade" />
                </div>
              </TableHead>

              <TableHead
                className="w-28 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("potencial")}
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Potencial <SortIcon columnKey="potencial" />
                </div>
              </TableHead>

              <TableHead
                className="cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("valor")}
              >
                <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Valor <SortIcon columnKey="valor" />
                </div>
              </TableHead>

              <TableHead
                className="hidden md:table-cell cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("salario")}
              >
                <div className="flex items-center justify-end gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Salário/ano <SortIcon columnKey="salario" />
                </div>
              </TableHead>

              <TableHead
                className="w-20 cursor-pointer select-none hover:bg-secondary/40 transition-colors"
                onClick={() => handleSort("contrato")}
              >
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Contrato <SortIcon columnKey="contrato" />
                </div>
              </TableHead>

              {canEdit && (
                <TableHead className="text-center w-16 text-[10px] uppercase tracking-wider whitespace-nowrap">
                  Venda
                </TableHead>
              )}
              {canEdit && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 12 : 10} className="text-center py-8 text-muted-foreground">
                  Nenhum jogador encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((p: any) => {
                const shirt = p.attributes?.shirtNumber;
                const stars = calcStars(p.habilidade, club.rate);
                const potStars = p.potential_max ? calcStars(p.potential_max, club.rate) : null;
                const expirando =
                  p.contrato_ate !== null && p.contrato_ate !== undefined && p.contrato_ate - temporadaAtual <= 1;
                const ps = getPositionStyle(p.position);

                return (
                  <TableRow
                    key={p.id}
                    className={`border-border/30 hover:bg-primary/5 transition-colors text-sm ${p.a_venda ? "bg-primary/5" : ""}`}
                  >
                    <TableCell className="text-[11px] text-center text-muted-foreground/60 py-2">
                      {shirt ?? "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <span
                        className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${ps.bg} ${ps.color}`}
                      >
                        {p.position || "—"}
                      </span>
                    </TableCell>
                    <TableCell className="py-2 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate max-w-[160px]">{p.name}</span>
                        {p.a_venda && (
                          <span title="À venda">
                            <Tag className="h-3 w-3 text-primary/70 shrink-0" />
                          </span>
                        )}
                        {expirando && (
                          <span title="Contrato expirando">
                            <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 hidden sm:table-cell">
                      <FlagImg nationality={p.nationality || ""} />
                    </TableCell>
                    <TableCell className="py-2 text-center text-xs text-muted-foreground tabular-nums">
                      {p.age ?? "—"}
                    </TableCell>
                    <TableCell className="py-2">
                      <StarRating value={stars} />
                    </TableCell>
                    <TableCell className="py-2">
                      {potStars !== null ? (
                        <StarRating value={potStars} />
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs font-semibold text-primary tabular-nums">
                      {formatCurrency(Number(p.market_value))}
                    </TableCell>
                    <TableCell className="py-2 text-right text-xs text-muted-foreground tabular-nums hidden md:table-cell">
                      {formatCurrency(Number(p.salario_atual || 0))}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <ContractBadge contrato_ate={p.contrato_ate ?? null} temporadaAtual={temporadaAtual} />
                    </TableCell>
                    {canEdit && (
                      <TableCell className="py-2 text-center">
                        <Switch checked={!!p.a_venda} onCheckedChange={(v) => toggleSale(p.id, v)} />
                      </TableCell>
                    )}
                    {canEdit && (
                      <TableCell className="py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Renovar contrato"
                          onClick={() => setRenewPlayer(p)}
                          className="h-7 w-7"
                        >
                          <FileSignature className="h-3.5 w-3.5 text-primary" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, positive }: any) => (
  <Card className="p-4 bg-gradient-card border-border/50">
    <div className="flex items-center gap-3">
      <div
        className={`h-9 w-9 rounded-lg flex items-center justify-center ${positive ? "bg-success/20 text-success" : "bg-primary/10 text-primary"}`}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display font-bold truncate">{value}</div>
      </div>
    </div>
  </Card>
);

const Row = ({
  label,
  value,
  positive,
  bold,
}: {
  label: string;
  value: number;
  positive?: boolean;
  bold?: boolean;
}) => (
  <div className={`flex items-center justify-between ${bold ? "font-display font-bold" : ""}`}>
    <span className="text-muted-foreground">{label}</span>
    <span className={positive ? "text-success" : "text-destructive"}>{formatCurrency(value)}</span>
  </div>
);

export default ClubDetail;
