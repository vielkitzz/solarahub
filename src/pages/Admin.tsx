import { useEffect, useState, useRef, DragEvent, ChangeEvent } from "react";
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
import { Settings, Plus, ArrowRightLeft, Upload, FileJson, Pencil, Trash2, Shield, CalendarClock, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { toast } from "sonner";
import { ImageUpload } from "@/components/ImageUpload";
import { parseSquadJson, ImportedPlayer } from "@/lib/squad-import";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [clubs, setClubs] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

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

  // season turnover state (must be before any early return)
  const [seasonRunning, setSeasonRunning] = useState(false);
  const [seasonResult, setSeasonResult] = useState<any[] | null>(null);
  const [confirmSeason, setConfirmSeason] = useState(false);

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
    }).eq("id", editClub.id);
    if (error) return toast.error(error.message);
    toast.success("Clube atualizado!");
    setEditClub(null);
    load();
  };

  const [seasonRunning, setSeasonRunning] = useState(false);
  const [seasonResult, setSeasonResult] = useState<any[] | null>(null);
  const [confirmSeason, setConfirmSeason] = useState(false);

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
      // Apaga elenco atual desse clube (não toca nos outros — separação por time)
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

  const transferPlayer = async () => {
    if (!tPlayer) return toast.error("Selecione um jogador");
    const newClubId = tNewClub === "none" ? null : tNewClub;
    const { error } = await supabase.from("players").update({ club_id: newClubId }).eq("id", tPlayer);
    if (error) return toast.error(error.message);
    const fee = parseFloat(tFee);
    if (fee > 0 && newClubId) {
      const player = players.find((p) => p.id === tPlayer);
      if (player?.club_id) {
        await supabase.from("transactions").insert([
          { club_id: player.club_id, type: "income", amount: fee, description: `Venda de ${player.name}`, category: "Transferência", created_by: user.id },
          { club_id: newClubId, type: "expense", amount: fee, description: `Compra de ${player.name}`, category: "Transferência", created_by: user.id },
        ]);
      }
    }
    toast.success("Transferência concluída!");
    setTPlayer(""); setTNewClub("none"); setTFee("");
    load();
  };

  // Agrupa jogadores por clube para visualização
  const playersByClub = players.reduce((acc: Record<string, any[]>, p: any) => {
    const key = p.club_id || "__free__";
    (acc[key] = acc[key] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Painel do Administrador</h1>
          <p className="text-sm text-muted-foreground">Crie e edite clubes, importe elencos por JSON e gerencie transferências.</p>
        </div>
      </header>

      <Tabs defaultValue="clubs">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="clubs">Clubes</TabsTrigger>
          <TabsTrigger value="import">Importar Elenco</TabsTrigger>
          <TabsTrigger value="transfer">Transferências</TabsTrigger>
          <TabsTrigger value="season">Temporada</TabsTrigger>
        </TabsList>

        {/* CLUBES */}
        <TabsContent value="clubs" className="space-y-4 mt-4">
          <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
            <h3 className="font-display font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Novo Clube</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} /></div>
              <div><Label>Discord ID do dono</Label><Input value={cDiscordId} onChange={(e) => setCDiscordId(e.target.value)} placeholder="ex: 858559322370998343" /></div>
              <div className="md:col-span-2"><Label>Escudo</Label><ImageUpload value={cCrest} onChange={setCCrest} /></div>
              <div><Label>Cidade</Label><Input value={cCity} onChange={(e) => setCCity(e.target.value)} /></div>
              <div><Label>Estádio</Label><Input value={cStadium} onChange={(e) => setCStadium(e.target.value)} /></div>
              <div><Label>Capacidade</Label><Input type="number" value={cCapacity} onChange={(e) => setCCapacity(e.target.value)} /></div>
              <div><Label>Orçamento inicial</Label><Input type="number" value={cBudget} onChange={(e) => setCBudget(e.target.value)} /></div>
              <div><Label>Cor primária (hex)</Label><Input value={cColor} onChange={(e) => setCColor(e.target.value)} placeholder="#ffbe1a" /></div>
            </div>
            <Button onClick={createClub} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Criar Clube</Button>
          </Card>

          <div className="space-y-2">
            <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider">Clubes existentes</h3>
            {clubs.map((c) => (
              <Card key={c.id} className="p-3 bg-gradient-card border-border/50 flex items-center gap-3">
                <div className="h-10 w-10 flex items-center justify-center shrink-0">
                  {c.crest_url ? <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain" /> : <Shield className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{c.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{c.owner_discord_id || "sem dono"} · {playersByClub[c.id]?.length || 0} jogadores</div>
                </div>
                <div className="text-sm text-primary font-bold hidden sm:block">{formatCurrency(Number(c.budget))}</div>
                <Button size="sm" variant="outline" onClick={() => setEditClub({ ...c })}><Pencil className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="outline" onClick={() => deleteClub(c.id, c.name)} className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
              </Card>
            ))}
            {clubs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum clube ainda.</p>}
          </div>
        </TabsContent>

        {/* IMPORTAR ELENCO */}
        <TabsContent value="import" className="space-y-4 mt-4">
          <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
            <h3 className="font-display font-bold flex items-center gap-2"><FileJson className="h-4 w-4 text-primary" /> Importar elenco via JSON</h3>
            <p className="text-xs text-muted-foreground">
              Envie o arquivo .json exportado. Os jogadores serão associados <strong>somente</strong> ao clube selecionado — elencos de outros times não são afetados.
            </p>

            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <Label>Clube destino *</Label>
                <Select value={importClubId} onValueChange={setImportClubId}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modo</Label>
                <Select value={importMode} onValueChange={(v) => setImportMode(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="replace">Substituir elenco atual</SelectItem>
                    <SelectItem value="append">Adicionar ao elenco existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropJson}
              className={`rounded-xl border-2 border-dashed cursor-pointer p-8 text-center transition-all ${dragOver ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 bg-secondary/30"}`}
            >
              <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="font-medium">Arraste o .json ou clique para selecionar</p>
              <p className="text-xs text-muted-foreground mt-1">Formato esperado: export padrão com array <code>players[]</code></p>
              <input ref={fileRef} type="file" accept=".json,application/json" onChange={onPickJson} className="hidden" />
            </div>

            {importPreview && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm"><strong>{importPreview.length}</strong> jogadores no preview</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setImportPreview(null)}>Cancelar</Button>
                    <Button size="sm" onClick={confirmImport} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Confirmar importação</Button>
                  </div>
                </div>
                <div className="max-h-64 overflow-auto space-y-1">
                  {importPreview.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm bg-secondary/30 rounded px-3 py-1.5">
                      <span className="text-primary font-bold w-12">{p.position}</span>
                      <span className="flex-1 truncate">{p.name}</span>
                      <span className="text-xs text-muted-foreground">{p.age}a · {p.nationality}</span>
                      <span className="text-xs font-bold text-primary">{formatCurrency(p.market_value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* TRANSFERÊNCIAS */}
        <TabsContent value="transfer" className="space-y-4 mt-4">
          <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
            <h3 className="font-display font-bold flex items-center gap-2"><ArrowRightLeft className="h-4 w-4 text-primary" /> Transferir Jogador</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <div className="md:col-span-2"><Label>Jogador</Label>
                <Select value={tPlayer} onValueChange={setTPlayer}>
                  <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    {players.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.clubs?.name || "livre"})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Novo clube</Label>
                <Select value={tNewClub} onValueChange={setTNewClub}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Liberar (sem clube)</SelectItem>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-3"><Label>Valor da transferência (opcional, gera transações)</Label>
                <Input type="number" value={tFee} onChange={(e) => setTFee(e.target.value)} />
              </div>
            </div>
            <Button onClick={transferPlayer} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Confirmar Transferência</Button>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de edição de clube */}
      <Dialog open={!!editClub} onOpenChange={(o) => !o && setEditClub(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Editar Clube</DialogTitle></DialogHeader>
          {editClub && (
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Nome</Label><Input value={editClub.name || ""} onChange={(e) => setEditClub({ ...editClub, name: e.target.value })} /></div>
              <div><Label>Discord ID do dono</Label><Input value={editClub.owner_discord_id || ""} onChange={(e) => setEditClub({ ...editClub, owner_discord_id: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Escudo</Label><ImageUpload value={editClub.crest_url} onChange={(url) => setEditClub({ ...editClub, crest_url: url })} folder={editClub.id} /></div>
              <div><Label>Cidade</Label><Input value={editClub.city || ""} onChange={(e) => setEditClub({ ...editClub, city: e.target.value })} /></div>
              <div><Label>Estádio</Label><Input value={editClub.stadium_name || ""} onChange={(e) => setEditClub({ ...editClub, stadium_name: e.target.value })} /></div>
              <div><Label>Capacidade</Label><Input type="number" value={editClub.stadium_capacity || 0} onChange={(e) => setEditClub({ ...editClub, stadium_capacity: e.target.value })} /></div>
              <div><Label>Cor primária</Label><Input value={editClub.primary_color || ""} onChange={(e) => setEditClub({ ...editClub, primary_color: e.target.value })} placeholder="#ffbe1a" /></div>
              <div><Label>Ano de fundação</Label><Input type="number" value={editClub.founded_year || ""} onChange={(e) => setEditClub({ ...editClub, founded_year: e.target.value })} /></div>
              <div><Label>Caixa atual (€)</Label><Input type="number" value={editClub.budget ?? 0} onChange={(e) => setEditClub({ ...editClub, budget: e.target.value })} /></div>
              <div>
                <Label>Status</Label>
                <Select value={editClub.status || "ativo"} onValueChange={(v) => setEditClub({ ...editClub, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
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
              <div><Label>Rate (decimal, padrão 2.80)</Label><Input type="number" step="0.01" value={editClub.rate ?? 2.80} onChange={(e) => setEditClub({ ...editClub, rate: e.target.value })} /></div>
              <div><Label>Nível do estádio (1–5)</Label><Input type="number" min="1" max="5" value={editClub.nivel_estadio ?? 1} onChange={(e) => setEditClub({ ...editClub, nivel_estadio: e.target.value })} /></div>
              <div><Label>Nível da base (1–5)</Label><Input type="number" min="1" max="5" value={editClub.nivel_base ?? 1} onChange={(e) => setEditClub({ ...editClub, nivel_base: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditClub(null)}>Cancelar</Button>
            <Button onClick={saveEditClub} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admin;
