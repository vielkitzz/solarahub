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
  Settings, Plus, ArrowRightLeft, Upload, FileJson, Pencil, 
  Trash2, Shield, CalendarClock, AlertTriangle, Users, 
  Search, Filter, Database, TrendingUp, Info
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { EmpresasManager } from "@/components/EmpresasManager";
import { parseSquadJson, ImportedPlayer } from "@/lib/squad-import";
import { useSeason } from "@/contexts/SeasonContext";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [clubs, setClubs] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtros e Busca
  const [searchClub, setSearchClub] = useState("");
  const [searchPlayer, setSearchPlayer] = useState("");

  // create club
  const [cName, setCName] = useState("");
  const [cCrest, setCCrest] = useState<string | null>(null);
  const [cDiscordId, setCDiscordId] = useState("");
  const [cCity, setCCity] = useState("");
  const [cStadium, setCStadium] = useState("");
  const [cCapacity, setCCapacity] = useState("");
  const [cBudget, setCBudget] = useState("");
  const [cColor, setCColor] = useState("");

  // edit club dialog
  const [editClub, setEditClub] = useState<any>(null);

  // import squad
  const [importClubId, setImportClubId] = useState<string>("");
  const [importMode, setImportMode] = useState<"replace" | "append">("replace");
  const [importPreview, setImportPreview] = useState<ImportedPlayer[] | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // transfer
  const [tPlayer, setTPlayer] = useState<string>("");
  const [tNewClub, setTNewClub] = useState<string>("none");
  const [tFee, setTFee] = useState("");

  // season turnover state
  const [seasonRunning, setSeasonRunning] = useState(false);
  const [seasonResult, setSeasonResult] = useState<any[] | null>(null);
  const [confirmSeason, setConfirmSeason] = useState(false);
  
  // season settings
  const { currentSeason, updateSeason } = useSeason();
  const [newSeasonName, setNewSeasonName] = useState("");

  const load = async () => {
    setLoadingData(true);
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("players").select("*, clubs(name)").order("name"),
    ]);
    setClubs(cs || []);
    setPlayers(ps || []);
    setLoadingData(false);
  };

  useEffect(() => {
    document.title = "Admin — Solara Hub";
    if (isAdmin) load();
  }, [isAdmin]);

  // Memorized Filters
  const filteredClubs = useMemo(() => {
    return clubs.filter(c => c.name.toLowerCase().includes(searchClub.toLowerCase()));
  }, [clubs, searchClub]);

  const filteredPlayers = useMemo(() => {
    return players.filter(p => p.name.toLowerCase().includes(searchPlayer.toLowerCase()));
  }, [players, searchPlayer]);

  if (loading) return null;
  if (!user || !isAdmin) return <Navigate to="/" replace />;

  const createClub = async () => {
    if (!cName) return toast.error("Nome obrigatório");
    let owner_id: string | null = null;
    if (cDiscordId) {
      const { data: roleRow } = await supabase.from("user_roles").select("user_id").eq("discord_id", cDiscordId).limit(1).maybeSingle();
      owner_id = roleRow?.user_id ?? null;
      if (!owner_id) toast.warning("Esse Discord ID ainda não fez login. O dono será vinculado quando ele entrar.");
    }
    const { error } = await supabase.from("clubs").insert({
      name: cName, crest_url: cCrest, owner_id, owner_discord_id: cDiscordId || null,
      city: cCity || null, stadium_name: cStadium || null,
      stadium_capacity: parseInt(cCapacity) || 0, budget: parseFloat(cBudget) || 0,
      primary_color: cColor || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Clube criado!");
    setCName(""); setCCrest(null); setCDiscordId(""); setCCity(""); setCStadium(""); setCCapacity(""); setCBudget(""); setCColor("");
    load();
  };

  const saveEditClub = async () => {
    if (!editClub) return;
    const { error } = await supabase.from("clubs").update({
      name: editClub.name,
      crest_url: editClub.crest_url,
      owner_discord_id: editClub.owner_discord_id || null,
      city: editClub.city || null,
      stadium_name: editClub.stadium_name || null,
      stadium_capacity: parseInt(editClub.stadium_capacity) || 0,
      primary_color: editClub.primary_color || null,
      founded_year: parseInt(editClub.founded_year) || null,
      budget: editClub.budget !== undefined && editClub.budget !== "" ? parseFloat(editClub.budget) : 0,
      status: editClub.status || "ativo",
      rate: parseFloat(editClub.rate) || 2.80,
      reputacao: editClub.reputacao || null,
      nivel_estadio: parseInt(editClub.nivel_estadio) || 1,
      nivel_base: parseInt(editClub.nivel_base) || 1,
      patrocinio_anual: parseFloat(editClub.patrocinio_anual) || 0,
      posicao_ultima_temporada: editClub.posicao_ultima_temporada ? parseInt(editClub.posicao_ultima_temporada) : null,
    }).eq("id", editClub.id);
    if (error) return toast.error(error.message);
    toast.success("Clube atualizado!");
    setEditClub(null);
    load();
  };

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

  const deleteClub = async (id: string, name: string) => {
    if (!confirm(`Apagar o clube "${name}"? Os jogadores ficarão sem clube.`)) return;
    await supabase.from("players").update({ club_id: null }).eq("club_id", id);
    const { error } = await supabase.from("clubs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Clube removido");
    load();
  };

  const handleFileSelected = async (file: File) => {
    if (!importClubId) return toast.error("Selecione um clube primeiro");
    if (!file.name.endsWith(".json")) return toast.error("Envie um arquivo .json");
    try {
      const text = await file.text();
      const players = parseSquadJson(text);
      setImportPreview(players);
      toast.success(`${players.length} jogadores prontos para importar`);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onDropJson = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelected(file);
  };

  const onPickJson = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelected(file);
    e.target.value = "";
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

  const updateSeasonName = async () => {
    if (!newSeasonName.trim()) return toast.error("Nome da temporada obrigatório");
    try {
      await updateSeason(newSeasonName);
      toast.success("Temporada atualizada!");
      setNewSeasonName("");
    } catch (err: any) {
      toast.error(err.message || "Erro ao atualizar temporada");
    }
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
          supabase.from("clubs").update({ budget: Number(buyer.budget) - fee }).eq("id", newClubId),
          supabase.from("clubs").update({ budget: Number(seller.budget) + fee }).eq("id", player.club_id),
        ]);
      }
    }

    const { error } = await supabase.from("players").update({ club_id: newClubId }).eq("id", tPlayer);
    if (error) return toast.error(error.message);
    toast.success("Transferência concluída!");
    setTPlayer(""); setTNewClub("none"); setTFee("");
    load();
  };

  const playersByClub = useMemo(() => {
    return players.reduce((acc: Record<string, any[]>, p: any) => {
      const key = p.club_id || "__free__";
      (acc[key] = acc[key] || []).push(p);
      return acc;
    }, {});
  }, [players]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-10">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">Administração</h1>
            <p className="text-sm text-muted-foreground">Gestão global da liga, clubes e jogadores.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 border-primary/40 text-primary bg-primary/5">
            {currentSeason || "Carregando..."}
          </Badge>
          <Button variant="outline" size="sm" onClick={load} disabled={loadingData}>
            <Database className={`h-4 w-4 mr-2 ${loadingData ? "animate-spin" : ""}`} /> Sincronizar
          </Button>
        </div>
      </header>

      <Tabs defaultValue="clubs" className="w-full">
        <TabsList className="bg-secondary/50 p-1 h-auto flex-wrap justify-start">
          <TabsTrigger value="clubs" className="gap-2"><Shield className="h-4 w-4" /> Clubes</TabsTrigger>
          <TabsTrigger value="players" className="gap-2"><Users className="h-4 w-4" /> Jogadores</TabsTrigger>
          <TabsTrigger value="import" className="gap-2"><Upload className="h-4 w-4" /> Importação</TabsTrigger>
          <TabsTrigger value="transfer" className="gap-2"><ArrowRightLeft className="h-4 w-4" /> Mercado</TabsTrigger>
          <TabsTrigger value="empresas" className="gap-2"><TrendingUp className="h-4 w-4" /> Empresas</TabsTrigger>
          <TabsTrigger value="season" className="gap-2"><CalendarClock className="h-4 w-4" /> Temporada</TabsTrigger>
        </TabsList>

        {/* CLUBES */}
        <TabsContent value="clubs" className="space-y-4 mt-6">
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-4">
              <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
                <h3 className="font-display font-bold flex items-center gap-2"><Plus className="h-5 w-5 text-primary" /> Novo Clube</h3>
                <div className="space-y-3">
                  <div><Label>Nome do Clube *</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Ex: Boca del Trueno" /></div>
                  <div><Label>Discord ID do Dono</Label><Input value={cDiscordId} onChange={(e) => setCDiscordId(e.target.value)} placeholder="ID numérico" /></div>
                  <div><Label>Escudo</Label><ImageUpload value={cCrest} onChange={setCCrest} /></div>
                  <Button onClick={createClub} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">Criar Clube</Button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar clube pelo nome..." 
                    className="pl-9" 
                    value={searchClub}
                    onChange={(e) => setSearchClub(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                {filteredClubs.map((c) => (
                  <Card key={c.id} className="p-4 bg-gradient-card border-border/50 hover:border-primary/40 transition-all flex items-center gap-3 group">
                    <div className="h-12 w-12 flex items-center justify-center shrink-0 bg-secondary/30 rounded-lg">
                      {c.crest_url ? <img src={c.crest_url} alt={c.name} className="h-10 w-10 object-contain" /> : <Shield className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate group-hover:text-primary transition-colors">{c.name}</div>
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                        <Users className="h-3 w-3" /> {playersByClub[c.id]?.length || 0} Elenco · {formatCurrency(c.budget)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => setEditClub({ ...c })} className="h-8 w-8"><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteClub(c.id, c.name)} className="h-8 w-8 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </Card>
                ))}
                {filteredClubs.length === 0 && <p className="col-span-full text-center py-10 text-muted-foreground">Nenhum clube encontrado.</p>}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* JOGADORES */}
        <TabsContent value="players" className="space-y-4 mt-6">
          <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold text-lg">Banco de Dados de Jogadores</h3>
                <Badge variant="secondary">{players.length} Total</Badge>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar jogador..." 
                  className="pl-9" 
                  value={searchPlayer}
                  onChange={(e) => setSearchPlayer(e.target.value)}
                />
              </div>
            </div>

            <div className="rounded-xl border border-border/50 overflow-hidden">
              <Table>
                <TableHeader className="bg-secondary/30">
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Clube</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead className="text-center">Overall</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlayers.slice(0, 50).map((p) => (
                    <TableRow key={p.id} className="hover:bg-primary/5 border-border/50">
                      <TableCell className="font-bold">{p.name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Shield className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{p.clubs?.name || "Livre"}</span>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{p.position}</Badge></TableCell>
                      <TableCell className="text-center font-display font-bold text-primary">{p.overall || "—"}</TableCell>
                      <TableCell className="text-right font-display font-bold">{formatCurrency(p.market_value)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredPlayers.length > 50 && (
                <div className="p-4 text-center text-xs text-muted-foreground bg-secondary/10 border-t border-border/50">
                  Exibindo primeiros 50 resultados de {filteredPlayers.length}.
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* IMPORTAÇÃO */}
        <TabsContent value="import" className="space-y-4 mt-6">
          <Card className="p-6 bg-gradient-card border-border/50 space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileJson className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-display font-bold text-xl">Importador de Elencos</h3>
                <p className="text-sm text-muted-foreground">Atualize ou crie elencos inteiros via arquivo JSON.</p>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clube de Destino</Label>
                <Select value={importClubId} onValueChange={setImportClubId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um clube..." /></SelectTrigger>
                  <SelectContent>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Modo de Importação</Label>
                <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">Substituir Elenco (Apaga atual)</SelectItem>
                    <SelectItem value="append">Adicionar (Mantém atual)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropJson}
              className={`rounded-2xl border-2 border-dashed cursor-pointer p-12 text-center transition-all ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-secondary/20"}`}
            >
              <Upload className="h-10 w-10 text-primary mx-auto mb-4" />
              <p className="font-bold text-lg">Arraste o arquivo .json</p>
              <p className="text-sm text-muted-foreground mt-2">Ou clique para selecionar manualmente</p>
              <input ref={fileRef} type="file" accept=".json,application/json" onChange={onPickJson} className="hidden" />
            </div>

            {importPreview && (
              <div className="space-y-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-primary" />
                    <span className="font-bold">{importPreview.length} jogadores detectados</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setImportPreview(null)}>Descartar</Button>
                    <Button size="sm" onClick={confirmImport} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Confirmar e Importar</Button>
                  </div>
                </div>
                <div className="max-h-60 overflow-auto grid sm:grid-cols-2 gap-2">
                  {importPreview.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs bg-secondary/40 rounded-lg p-2 border border-border/50">
                      <Badge variant="outline" className="text-[10px] h-5 px-1">{p.position}</Badge>
                      <span className="flex-1 truncate font-medium">{p.name}</span>
                      <span className="text-primary font-bold">{p.overall}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* MERCADO / TRANSFERÊNCIAS */}
        <TabsContent value="transfer" className="space-y-4 mt-6">
          <Card className="p-6 bg-gradient-card border-border/50 space-y-6">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-6 w-6 text-primary" />
              <h3 className="font-display font-bold text-xl">Transferência Administrativa</h3>
            </div>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-2">
                <Label>Jogador</Label>
                <Select value={tPlayer} onValueChange={setTPlayer}>
                  <SelectTrigger><SelectValue placeholder="Selecione o jogador..." /></SelectTrigger>
                  <SelectContent>
                    {players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.clubs?.name || "Livre"})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Novo Clube</Label>
                <Select value={tNewClub} onValueChange={setTNewClub}>
                  <SelectTrigger><SelectValue placeholder="Destino..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Dispensar (Livre)</SelectItem>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3 space-y-2">
                <Label>Taxa de Transferência (€) <span className="text-muted-foreground font-normal">(Opcional: Ajusta caixas automaticamente)</span></Label>
                <Input type="number" value={tFee} onChange={(e) => setTFee(e.target.value)} placeholder="0" />
              </div>
            </div>
            <Button onClick={transferPlayer} className="w-full bg-gradient-gold text-primary-foreground hover:opacity-90">Executar Transferência</Button>
          </Card>
        </TabsContent>

        {/* EMPRESAS */}
        <TabsContent value="empresas" className="mt-6">
          <EmpresasManager />
        </TabsContent>

        {/* TEMPORADA */}
        <TabsContent value="season" className="space-y-4 mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
              <h3 className="font-display font-bold flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Configurações Gerais</h3>
              <div className="space-y-4">
                <div>
                  <Label>Nome da Temporada Atual</Label>
                  <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Atualmente: <span className="text-primary font-bold">{currentSeason}</span></p>
                  <div className="flex gap-2">
                    <Input 
                      value={newSeasonName} 
                      onChange={(e) => setNewSeasonName(e.target.value)} 
                      placeholder="Ex: Temporada 2024" 
                    />
                    <Button onClick={updateSeasonName} variant="outline">Salvar</Button>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
              <h3 className="font-display font-bold flex items-center gap-2 text-destructive"><CalendarClock className="h-5 w-5" /> Virada de Temporada</h3>
              <p className="text-xs text-muted-foreground">
                Processa receitas, despesas e salários de todos os clubes ativos simultaneamente.
              </p>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
                <p className="text-[10px] text-destructive font-bold uppercase tracking-tighter flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Atenção: Esta ação é irreversível
                </p>
                <ul className="text-[10px] space-y-1 text-muted-foreground">
                  <li>• Calcula Receita Base (Reputação)</li>
                  <li>• Adiciona Bilheteria e Patrocínios</li>
                  <li>• Deduz Manutenção da Base e Estádio</li>
                  <li>• Paga Folha Salarial Completa</li>
                </ul>
              </div>
              <Button onClick={() => setConfirmSeason(true)} variant="destructive" className="w-full" disabled={seasonRunning}>
                {seasonRunning ? "Processando..." : "Executar Virada Global"}
              </Button>
            </Card>
          </div>

          {seasonResult && (
            <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
              <h4 className="font-bold flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Relatório da Virada ({seasonResult.length} Clubes)</h4>
              <div className="max-h-64 overflow-auto space-y-1">
                {seasonResult.map((r) => (
                  <div key={r.club_id} className="flex items-center justify-between text-xs bg-secondary/30 rounded px-3 py-2 border border-border/50">
                    <span className="font-bold">{r.club_name}</span>
                    <div className="flex items-center gap-4">
                      <span className={Number(r.delta) >= 0 ? "text-primary font-bold" : "text-destructive font-bold"}>
                        {Number(r.delta) >= 0 ? "+" : ""}{formatCurrency(Number(r.delta))}
                      </span>
                      <span className="text-muted-foreground">→ {formatCurrency(Number(r.novo_caixa))}</span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* MODALS */}
      <Dialog open={confirmSeason} onOpenChange={setConfirmSeason}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive"><AlertTriangle className="h-5 w-5" /> Confirmar Virada de Temporada</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Você está prestes a processar as finanças de todos os clubes da liga. Certifique-se de que todos os resultados e patrocínios foram devidamente lançados.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSeason(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={runSeason} disabled={seasonRunning}>Confirmar Processamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editClub} onOpenChange={(o) => !o && setEditClub(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Clube: {editClub?.name}</DialogTitle></DialogHeader>
          {editClub && (
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={editClub.name || ""} onChange={(e) => setEditClub({ ...editClub, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Discord ID do Dono</Label>
                <Input value={editClub.owner_discord_id || ""} onChange={(e) => setEditClub({ ...editClub, owner_discord_id: e.target.value })} />
              </div>
              <div className="md:col-span-2 space-y-2">
                <Label>Escudo</Label>
                <ImageUpload value={editClub.crest_url} onChange={(url) => setEditClub({ ...editClub, crest_url: url })} folder={editClub.id} />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={editClub.city || ""} onChange={(e) => setEditClub({ ...editClub, city: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Estádio</Label>
                <Input value={editClub.stadium_name || ""} onChange={(e) => setEditClub({ ...editClub, stadium_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Capacidade</Label>
                <Input type="number" value={editClub.stadium_capacity || 0} onChange={(e) => setEditClub({ ...editClub, stadium_capacity: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Cor Primária</Label>
                <Input value={editClub.primary_color || ""} onChange={(e) => setEditClub({ ...editClub, primary_color: e.target.value })} placeholder="#ffbe1a" />
              </div>
              <div className="space-y-2">
                <Label>Caixa Atual (€)</Label>
                <Input type="number" value={editClub.budget ?? 0} onChange={(e) => setEditClub({ ...editClub, budget: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Reputação</Label>
                <Select value={editClub.reputacao || ""} onValueChange={(v) => setEditClub({ ...editClub, reputacao: v })}>
                  <SelectTrigger><SelectValue placeholder="Definir..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="estadual">Estadual</SelectItem>
                    <SelectItem value="nacional">Nacional</SelectItem>
                    <SelectItem value="continental">Continental</SelectItem>
                    <SelectItem value="mundial">Mundial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rate (3.0 base)</Label>
                <Input type="number" step="0.01" value={editClub.rate ?? 2.80} onChange={(e) => setEditClub({ ...editClub, rate: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nível Estádio (1-5)</Label>
                <Input type="number" min="1" max="5" value={editClub.nivel_estadio ?? 1} onChange={(e) => setEditClub({ ...editClub, nivel_estadio: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nível Base (1-5)</Label>
                <Input type="number" min="1" max="5" value={editClub.nivel_base ?? 1} onChange={(e) => setEditClub({ ...editClub, nivel_base: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Patrocínio Anual (€)</Label>
                <Input type="number" value={editClub.patrocinio_anual ?? 0} onChange={(e) => setEditClub({ ...editClub, patrocinio_anual: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Posição Última Temp.</Label>
                <Input type="number" min="1" max="20" value={editClub.posicao_ultima_temporada ?? ""} onChange={(e) => setEditClub({ ...editClub, posicao_ultima_temporada: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setEditClub(null)}>Cancelar</Button>
            <Button onClick={saveEditClub} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Salvar Alterações</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
