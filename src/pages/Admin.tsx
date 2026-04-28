import { useEffect, useState, useRef, DragEvent, ChangeEvent, useMemo } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Settings,
  Plus,
  ArrowRightLeft,
  Upload,
  FileJson,
  Pencil,
  Trash2,
  Shield,
  CalendarClock,
  AlertTriangle,
  UsersRound,
  LayoutDashboard,
  Search,
  Coins,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { EmpresasManager } from "@/components/EmpresasManager";
import { SeasonPreview } from "@/components/admin/SeasonPreview";
import { EconomyParams } from "@/components/admin/EconomyParams";
import { BulkBudgetAdjuster } from "@/components/admin/BulkBudgetAdjuster";
import { PlayerBulkActions } from "@/components/admin/PlayerBulkActions";
import { parseSquadJson, ImportedPlayer } from "@/lib/squad-import";
import { useSeason } from "@/contexts/SeasonContext";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();

  // Dados globais
  const [clubs, setClubs] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [searchPlayer, setSearchPlayer] = useState("");

  // Dialogs de Edição/Criação
  const [editClub, setEditClub] = useState<any>(null);
  const [isCreatingClub, setIsCreatingClub] = useState(false);
  const [editPlayer, setEditPlayer] = useState<any>(null);

  // Importação JSON
  const [importClubId, setImportClubId] = useState<string>("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importPreview, setImportPreview] = useState<ImportedPlayer[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Transferência
  const [tPlayer, setTPlayer] = useState<string>("");
  const [tNewClub, setTNewClub] = useState<string>("none");
  const [tFee, setTFee] = useState("");

  // Virada de Temporada
  const [seasonRunning, setSeasonRunning] = useState(false);
  const [seasonResult, setSeasonResult] = useState<any[] | null>(null);
  const [confirmSeason, setConfirmSeason] = useState(false);

  // Configurações
  const { currentSeason, updateSeason } = useSeason();
  const [newSeasonName, setNewSeasonName] = useState("");

  const load = async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("players").select("*, clubs(name)").order("name"),
    ]);
    setClubs(cs || []);
    setPlayers(ps || []);
  };

  useEffect(() => {
    document.title = "Admin — Solara Hub";
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return null;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  // ESTATÍSTICAS DO DASHBOARD
  const totalBudget = clubs.reduce((acc, c) => acc + Number(c.budget || 0), 0);
  const activeClubs = clubs.filter((c) => c.status === "ativo").length;

  // GERENCIAMENTO DE CLUBES
  const saveClub = async () => {
    if (!editClub.name) return toast.error("Nome obrigatório");

    let owner_id: string | null = editClub.owner_id || null;

    if (editClub.owner_discord_id && !owner_id) {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("discord_id", editClub.owner_discord_id)
        .limit(1)
        .maybeSingle();
      owner_id = roleRow?.user_id ?? null;
    }

    const payload = {
      name: editClub.name,
      crest_url: editClub.crest_url || null,
      owner_id,
      owner_discord_id: editClub.owner_discord_id || null,
      city: editClub.city || null,
      stadium_name: editClub.stadium_name || null,
      stadium_capacity: parseInt(editClub.stadium_capacity) || 0,
      primary_color: editClub.primary_color || null,
      founded_year: parseInt(editClub.founded_year) || null,
      budget: parseFloat(editClub.budget) || 0,
      status: editClub.status || "ativo",
      rate: parseFloat(editClub.rate) || 2.8,
      reputacao: editClub.reputacao || "estadual",
      nivel_estadio: parseInt(editClub.nivel_estadio) || 1,
      nivel_base: parseInt(editClub.nivel_base) || 1,
      patrocinio_anual: parseFloat(editClub.patrocinio_anual) || 0,
      posicao_ultima_temporada: editClub.posicao_ultima_temporada ? parseInt(editClub.posicao_ultima_temporada) : null,
    };

    if (isCreatingClub) {
      const { error } = await supabase.from("clubs").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Clube criado com sucesso!");
    } else {
      const { error } = await supabase.from("clubs").update(payload).eq("id", editClub.id);
      if (error) return toast.error(error.message);
      toast.success("Clube atualizado com sucesso!");
    }

    setEditClub(null);
    setIsCreatingClub(false);
    load();
  };

  const deleteClub = async (id: string, name: string) => {
    if (!confirm(`Apagar o clube "${name}"? Os jogadores ficarão sem clube.`)) return;
    await supabase.from("players").update({ club_id: null }).eq("club_id", id);
    const { error } = await supabase.from("clubs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Clube removido");
    load();
  };

  // GERENCIAMENTO DE JOGADORES
  const savePlayer = async () => {
    if (!editPlayer.name) return toast.error("Nome obrigatório");
    const { error } = await supabase
      .from("players")
      .update({
        name: editPlayer.name,
        age: parseInt(editPlayer.age) || null,
        position: editPlayer.position,
        market_value: parseFloat(editPlayer.market_value) || 0,
        salario_atual: parseFloat(editPlayer.salario_atual) || 0,
        habilidade: parseFloat(editPlayer.habilidade) || 0,
        nationality: editPlayer.nationality || null,
      })
      .eq("id", editPlayer.id);

    if (error) return toast.error(error.message);
    toast.success("Jogador atualizado!");
    setEditPlayer(null);
    load();
  };

  const transferPlayer = async () => {
    if (!tPlayer) return toast.error("Selecione um jogador");
    const newClubId = tNewClub === "none" ? null : tNewClub;
    const fee = parseFloat(tFee);
    const player = players.find((p) => p.id === tPlayer);

    if (fee > 0 && newClubId && player?.club_id) {
      const [{ data: buyer }, { data: seller }] = await Promise.all([
        supabase.from("clubs").select("budget").eq("id", newClubId).maybeSingle(),
        supabase.from("clubs").select("budget").eq("id", player.club_id).maybeSingle(),
      ]);
      if (buyer && seller) {
        await Promise.all([
          supabase
            .from("clubs")
            .update({ budget: Number(buyer.budget) - fee })
            .eq("id", newClubId),
          supabase
            .from("clubs")
            .update({ budget: Number(seller.budget) + fee })
            .eq("id", player.club_id),
        ]);
      }
    }

    const { error } = await supabase.from("players").update({ club_id: newClubId }).eq("id", tPlayer);
    if (error) return toast.error(error.message);
    toast.success("Transferência concluída!");
    setTPlayer("");
    setTNewClub("none");
    setTFee("");
    load();
  };

  // IMPORTAÇÃO
  const handleFileSelected = async (file: File) => {
    if (!importClubId) return toast.error("Selecione um clube primeiro");
    if (!file.name.endsWith(".json")) return toast.error("Envie um arquivo .json");
    try {
      const text = await file.text();
      const imported = parseSquadJson(text);
      setImportPreview(imported);
      toast.success(`${imported.length} jogadores prontos para importar`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const confirmImport = async () => {
    if (!importPreview || !importClubId) return;
    if (importMode === "replace") {
      const { error: delErr } = await supabase.from("players").delete().eq("club_id", importClubId);
      if (delErr) return toast.error(delErr.message);
    }
    const rows = importPreview.map((p) => ({ ...p, club_id: importClubId }));
    const { error } = await supabase.from("players").insert(rows);
    if (error) return toast.error(error.message);
    toast.success(`${rows.length} jogadores importados!`);
    setImportPreview(null);
    load();
  };

  // TEMPORADA
  const runSeason = async () => {
    setSeasonRunning(true);
    const { data, error } = await supabase.rpc("process_season_turnover");
    setSeasonRunning(false);
    setConfirmSeason(false);
    if (error) return toast.error(error.message);
    setSeasonResult(data || []);
    toast.success(`Temporada processada para ${data?.length || 0} clubes!`);
    load();
  };

  const updateSeasonName = async () => {
    if (!newSeasonName.trim()) return toast.error("Nome obrigatório");
    try {
      await updateSeason(newSeasonName);
      toast.success("Temporada atualizada!");
      setNewSeasonName("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar");
    }
  };

  const filteredPlayers = useMemo(() => {
    if (!searchPlayer) return players.slice(0, 50); // Mostra só 50 iniciais para não travar
    return players.filter((p) => p.name.toLowerCase().includes(searchPlayer.toLowerCase())).slice(0, 50);
  }, [players, searchPlayer]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <header className="relative flex items-center gap-4 bg-gradient-card border border-border/50 p-6 rounded-xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-gold opacity-60" />
        <div className="h-14 w-14 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
          <Shield className="h-7 w-7 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold font-display gold-text">Painel Administrador</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Controle total sobre clubes, elencos, finanças e temporadas do Solara Hub.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground bg-secondary/50 border border-border/40 rounded-lg px-3 py-1.5 shrink-0">
          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          Acesso Restrito
        </div>
      </header>

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="bg-transparent w-full flex overflow-x-auto justify-start border-b border-border/50 rounded-none h-11 p-0 gap-1">
          <TabsTrigger
            value="dashboard"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <LayoutDashboard className="h-4 w-4" /> Visão Geral
          </TabsTrigger>
          <TabsTrigger
            value="clubs"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <Shield className="h-4 w-4" /> Clubes
          </TabsTrigger>
          <TabsTrigger
            value="players"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <UsersRound className="h-4 w-4" /> Jogadores
          </TabsTrigger>
          <TabsTrigger
            value="empresas"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <ArrowRightLeft className="h-4 w-4" /> Empresas
          </TabsTrigger>
          <TabsTrigger
            value="economia"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <Coins className="h-4 w-4" /> Economia
          </TabsTrigger>
          <TabsTrigger
            value="season"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <CalendarClock className="h-4 w-4" /> Temporada
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-4"
          >
            <Settings className="h-4 w-4" /> Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-5 border-border/50 bg-gradient-card relative overflow-hidden group hover:border-primary/30 transition-colors">
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-gold opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Clubes Ativos</div>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-4xl font-display font-bold gold-text">{activeClubs}</div>
              <div className="text-sm text-muted-foreground mt-1">de {clubs.length} cadastrados</div>
            </Card>
            <Card className="p-5 border-border/50 bg-gradient-card relative overflow-hidden group hover:border-primary/30 transition-colors">
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-gold opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Jogadores Registrados
                </div>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UsersRound className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-4xl font-display font-bold text-foreground">{players.length}</div>
              <div className="text-sm text-muted-foreground mt-1">no banco de dados</div>
            </Card>
            <Card className="p-5 border-border/50 bg-gradient-card relative overflow-hidden group hover:border-primary/30 transition-colors">
              <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-gold opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Volume Financeiro Global
                </div>
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-3xl font-display font-bold gold-text truncate">{formatCurrency(totalBudget)}</div>
              <div className="text-sm text-muted-foreground mt-1">em caixa total</div>
            </Card>
          </div>
        </TabsContent>

        {/* CLUBES */}
        <TabsContent value="clubs" className="mt-6 space-y-4">
          <BulkBudgetAdjuster clubs={clubs} onDone={load} />

          <div className="flex justify-between items-center pt-2">
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" /> Gestão de Clubes
            </h3>
            <Button
              onClick={() => {
                setEditClub({});
                setIsCreatingClub(true);
              }}
              className="bg-gradient-gold text-primary-foreground"
            >
              <Plus className="h-4 w-4 mr-2" /> Novo Clube
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {clubs.map((c) => (
              <Card
                key={c.id}
                className="p-4 bg-gradient-card border-border/50 flex flex-col gap-3 group relative overflow-hidden hover:border-primary/30 transition-colors"
              >
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-gold opacity-0 group-hover:opacity-80 transition-opacity" />
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 flex items-center justify-center shrink-0 rounded-md bg-secondary/50 p-1">
                    {c.crest_url ? (
                      <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain" />
                    ) : (
                      <Shield className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate text-base leading-tight">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate capitalize">
                      {c.status} · Rate {c.rate}
                    </div>
                  </div>
                </div>
                <div className="flex justify-between items-end mt-auto pt-2 border-t border-border/30">
                  <div className="text-sm font-bold text-primary">{formatCurrency(Number(c.budget))}</div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-primary/20"
                      onClick={() => {
                        setEditClub({ ...c });
                        setIsCreatingClub(false);
                      }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 hover:bg-destructive/20 hover:text-destructive"
                      onClick={() => deleteClub(c.id, c.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* JOGADORES (Tudo centralizado aqui) */}
        <TabsContent value="players" className="mt-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Bloco 1: Lista e Edição Rápida */}
            <Card className="p-5 border-border/50 bg-gradient-card flex flex-col h-[500px]">
              <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                <UsersRound className="h-4 w-4 text-primary" /> Banco de Jogadores
              </h3>
              <div className="relative mb-3 shrink-0">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar jogador..."
                  value={searchPlayer}
                  onChange={(e) => setSearchPlayer(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 pr-2">
                {filteredPlayers.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/40 border border-transparent hover:border-border/50 transition-colors cursor-pointer"
                    onClick={() => setEditPlayer({ ...p })}
                  >
                    <div className="w-8 text-center text-xs font-bold text-primary">{p.position}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{p.clubs?.name || "Livre"}</div>
                    </div>
                    <div className="text-xs text-muted-foreground hidden sm:block">{p.age}a</div>
                    <div className="text-xs font-semibold">{formatCurrency(Number(p.market_value))}</div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-center text-muted-foreground mt-2 shrink-0">
                Mostrando {filteredPlayers.length} de {players.length}
              </div>
            </Card>

            <div className="space-y-6">
              {/* Bloco 2: Transferência Direta */}
              <Card className="p-5 border-border/50 bg-gradient-card">
                <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4 text-primary" /> Transferência Manual
                </h3>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">Jogador</Label>
                    <Select value={tPlayer} onValueChange={setTPlayer}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {players.slice(0, 100).map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name} ({p.clubs?.name || "livre"})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Destino</Label>
                      <Select value={tNewClub} onValueChange={setTNewClub}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Liberar (Sem Clube)</SelectItem>
                          {clubs.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Taxa (€)</Label>
                      <Input type="number" value={tFee} onChange={(e) => setTFee(e.target.value)} placeholder="0" />
                    </div>
                  </div>
                  <Button onClick={transferPlayer} className="w-full bg-gradient-gold text-primary-foreground">
                    Executar Transferência
                  </Button>
                </div>
              </Card>

              {/* Bloco 3: Importação JSON */}
              <Card className="p-5 border-border/50 bg-gradient-card">
                <h3 className="font-display font-bold mb-4 flex items-center gap-2">
                  <FileJson className="h-4 w-4 text-primary" /> Importação Massiva (JSON)
                </h3>
                <div className="space-y-3">
                  <Select value={importClubId} onValueChange={setImportClubId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o clube destino..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="replace">Substituir todo o elenco</SelectItem>
                      <SelectItem value="append">Adicionar ao elenco existente</SelectItem>
                    </SelectContent>
                  </Select>

                  {!importPreview ? (
                    <div
                      onClick={() => fileRef.current?.click()}
                      className="rounded-lg border-2 border-dashed border-border/50 hover:border-primary/60 hover:bg-primary/5 bg-secondary/20 p-6 text-center cursor-pointer transition-colors group"
                    >
                      <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary mx-auto mb-2 transition-colors" />
                      <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                        Arraste ou clique para enviar JSON
                      </p>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".json"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleFileSelected(f);
                          e.target.value = "";
                        }}
                        className="hidden"
                      />
                    </div>
                  ) : (
                    <div className="bg-primary/10 border border-primary/30 rounded-lg p-3 text-center">
                      <p className="text-sm font-bold text-primary mb-2">{importPreview.length} jogadores detectados</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="w-full" onClick={() => setImportPreview(null)}>
                          Cancelar
                        </Button>
                        <Button size="sm" className="w-full" onClick={confirmImport}>
                          Confirmar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            </div>
          </div>

          <PlayerBulkActions onChanged={load} />
        </TabsContent>

        {/* ABA: EMPRESAS (ECONOMIA) */}
        <TabsContent value="empresas" className="mt-6">
          <div className="max-w-4xl mx-auto">
            <EmpresasManager />
          </div>
        </TabsContent>

        {/* ABA: ECONOMIA (PARÂMETROS) */}
        <TabsContent value="economia" className="mt-6">
          <div className="max-w-4xl mx-auto">
            <EconomyParams />
          </div>
        </TabsContent>

        {/* ABA: TEMPORADA (PROCESSAMENTO) */}
        <TabsContent value="season" className="mt-6">
          <div className="max-w-5xl mx-auto space-y-6">
            <SeasonPreview />
            <Card className="p-6 bg-gradient-card border-destructive/30 relative overflow-hidden">
              <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
              <div className="relative space-y-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <CalendarClock className="h-6 w-6 text-destructive" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-destructive">Virada de Temporada Global</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Esta ação encerra o ciclo atual. O sistema irá calcular automaticamente:
                    </p>
                    <ul className="text-xs text-muted-foreground mt-2 list-disc list-inside space-y-1">
                      <li>Pagamento de salários de todos os elencos ativos.</li>
                      <li>Recebimento de patrocínios e direitos de TV.</li>
                      <li>Custo de manutenção de estádios e categorias de base.</li>
                      <li>Premiações baseadas na posição final da última temporada.</li>
                    </ul>
                  </div>
                </div>

                <div className="p-4 bg-secondary/20 rounded-lg border border-border/50">
                  <p className="text-xs text-center font-medium text-amber-500 flex items-center justify-center gap-2">
                    <AlertTriangle className="h-3 w-3" /> Certifique-se de que todos os resultados foram lançados antes
                    de prosseguir.
                  </p>
                </div>

                <Button
                  onClick={() => setConfirmSeason(true)}
                  variant="destructive"
                  className="w-full h-12 text-base font-bold shadow-lg shadow-destructive/20"
                  disabled={seasonRunning}
                >
                  {seasonRunning ? "Processando Virada..." : "Executar Virada Financeira"}
                </Button>

                {seasonResult && (
                  <div className="mt-6 border border-border/50 rounded-xl overflow-hidden bg-background/50">
                    <div className="bg-secondary/40 px-4 py-2.5 text-xs font-bold border-b border-border/50 flex justify-between">
                      <span>RELATÓRIO DE IMPACTO</span>
                      <span className="text-muted-foreground">{seasonResult.length} CLUBES PROCESSADOS</span>
                    </div>
                    <div className="max-h-80 overflow-auto p-2 space-y-1">
                      {seasonResult.map((r) => (
                        <div
                          key={r.club_id}
                          className="flex justify-between items-center text-xs p-2 hover:bg-secondary/30 rounded-md border border-transparent hover:border-border/20 transition-colors"
                        >
                          <span className="truncate font-medium w-1/3">{r.club_name}</span>
                          <span
                            className={`font-mono font-bold w-1/3 text-center ${Number(r.delta) >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {Number(r.delta) >= 0 ? "+" : ""}
                            {formatCurrency(Number(r.delta))}
                          </span>
                          <span className="font-mono text-muted-foreground w-1/3 text-right">
                            Saldo: {formatCurrency(Number(r.novo_caixa))}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* CONFIGURAÇÕES GLOBAIS */}
        <TabsContent value="config" className="mt-6">
          <Card className="p-5 bg-gradient-card border-border/50 max-w-lg relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-gold opacity-40" />
            <h3 className="font-display font-bold mb-4 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" /> Variáveis do Sistema
            </h3>
            <div className="space-y-4">
              <div>
                <Label>Nome da Temporada Vigente</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Exibido no cabeçalho e perfis. (Atual: {currentSeason})
                </p>
                <div className="flex gap-2">
                  <Input
                    value={newSeasonName}
                    onChange={(e) => setNewSeasonName(e.target.value)}
                    placeholder="ex: Temporada 2026"
                  />
                  <Button onClick={updateSeasonName} variant="secondary">
                    Atualizar
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOGS */}

      {/* Dialog Virada Temporada */}
      <Dialog open={confirmSeason} onOpenChange={setConfirmSeason}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Atenção Restrita
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A virada de temporada altera as finanças de todos os clubes de uma vez. Confirme se todas as premiações e
            configurações estão corretas antes de prosseguir.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSeason(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={runSeason} disabled={seasonRunning}>
              Estou ciente, Executar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar/Criar Clube (Unificado) */}
      <Dialog open={!!editClub} onOpenChange={(o) => !o && setEditClub(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreatingClub ? "Criar Novo Clube" : "Editar Clube"}</DialogTitle>
          </DialogHeader>
          {editClub && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <Label>Nome do Clube *</Label>
                <Input
                  value={editClub.name || ""}
                  onChange={(e) => setEditClub({ ...editClub, name: e.target.value })}
                />
              </div>

              <div className="md:col-span-1 space-y-4">
                <div>
                  <Label>Escudo URL</Label>
                  <ImageUpload
                    value={editClub.crest_url}
                    onChange={(url) => setEditClub({ ...editClub, crest_url: url })}
                    folder={editClub.id || "temp"}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editClub.status || "ativo"}
                    onValueChange={(v) => setEditClub({ ...editClub, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Reputação</Label>
                  <Select
                    value={editClub.reputacao || "estadual"}
                    onValueChange={(v) => setEditClub({ ...editClub, reputacao: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="estadual">Estadual</SelectItem>
                      <SelectItem value="nacional">Nacional</SelectItem>
                      <SelectItem value="continental">Continental</SelectItem>
                      <SelectItem value="mundial">Mundial</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="md:col-span-2 grid grid-cols-2 gap-3">
                <div>
                  <Label>Discord ID Dono</Label>
                  <Input
                    value={editClub.owner_discord_id || ""}
                    onChange={(e) => setEditClub({ ...editClub, owner_discord_id: e.target.value })}
                    placeholder="Deixe em branco se CPU"
                  />
                </div>
                <div>
                  <Label>Caixa Inicial/Atual (€)</Label>
                  <Input
                    type="number"
                    value={editClub.budget ?? 0}
                    onChange={(e) => setEditClub({ ...editClub, budget: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cidade</Label>
                  <Input
                    value={editClub.city || ""}
                    onChange={(e) => setEditClub({ ...editClub, city: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Ano Fundação</Label>
                  <Input
                    type="number"
                    value={editClub.founded_year || ""}
                    onChange={(e) => setEditClub({ ...editClub, founded_year: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Estádio</Label>
                  <Input
                    value={editClub.stadium_name || ""}
                    onChange={(e) => setEditClub({ ...editClub, stadium_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Capacidade</Label>
                  <Input
                    type="number"
                    value={editClub.stadium_capacity ?? 0}
                    onChange={(e) => setEditClub({ ...editClub, stadium_capacity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Cor Primária</Label>
                  <Input
                    type="color"
                    value={editClub.primary_color || "#ffffff"}
                    onChange={(e) => setEditClub({ ...editClub, primary_color: e.target.value })}
                    className="h-9 p-1"
                  />
                </div>
                <div>
                  <Label>Rate Base (ex: 2.80)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editClub.rate ?? 2.8}
                    onChange={(e) => setEditClub({ ...editClub, rate: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nível Estádio (1-5)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={editClub.nivel_estadio ?? 1}
                    onChange={(e) => setEditClub({ ...editClub, nivel_estadio: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Nível Base (1-5)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="5"
                    value={editClub.nivel_base ?? 1}
                    onChange={(e) => setEditClub({ ...editClub, nivel_base: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClub(null)}>
              Cancelar
            </Button>
            <Button onClick={saveClub} className="bg-gradient-gold text-primary-foreground">
              Salvar Clube
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Editar Jogador (Nova Função) */}
      <Dialog open={!!editPlayer} onOpenChange={(o) => !o && setEditPlayer(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Informações do Jogador</DialogTitle>
          </DialogHeader>
          {editPlayer && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <div className="col-span-2">
                <Label>Nome Completo</Label>
                <Input
                  value={editPlayer.name}
                  onChange={(e) => setEditPlayer({ ...editPlayer, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Posição</Label>
                <Input
                  value={editPlayer.position}
                  onChange={(e) => setEditPlayer({ ...editPlayer, position: e.target.value })}
                />
              </div>
              <div>
                <Label>Idade</Label>
                <Input
                  type="number"
                  value={editPlayer.age || ""}
                  onChange={(e) => setEditPlayer({ ...editPlayer, age: e.target.value })}
                />
              </div>
              <div>
                <Label>Qualidade (Overall)</Label>
                <Input
                  type="number"
                  value={editPlayer.habilidade || 0}
                  onChange={(e) => setEditPlayer({ ...editPlayer, habilidade: e.target.value })}
                />
              </div>
              <div>
                <Label>Nacionalidade (ISO)</Label>
                <Input
                  value={editPlayer.nationality || ""}
                  onChange={(e) => setEditPlayer({ ...editPlayer, nationality: e.target.value })}
                />
              </div>
              <div>
                <Label>Valor de Mercado (€)</Label>
                <Input
                  type="number"
                  value={editPlayer.market_value || 0}
                  onChange={(e) => setEditPlayer({ ...editPlayer, market_value: e.target.value })}
                />
              </div>
              <div>
                <Label>Salário Atual (€)</Label>
                <Input
                  type="number"
                  value={editPlayer.salario_atual || 0}
                  onChange={(e) => setEditPlayer({ ...editPlayer, salario_atual: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setEditPlayer(null)}>
              Cancelar
            </Button>
            <Button onClick={savePlayer} className="bg-gradient-gold text-primary-foreground">
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
