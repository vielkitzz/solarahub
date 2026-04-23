import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
import { Shield, MapPin, Users, Wallet, Building2, TrendingUp, TrendingDown, Save, Plus, Tag } from "lucide-react";
import { formatCurrency, POSITIONS } from "@/lib/format";
import { flagUrl } from "@/lib/countries";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RichEditor } from "@/components/RichEditor";
import { WikiSectionsEditor, WikiSectionsView, WikiData } from "@/components/WikiSections";
import { ImageUpload } from "@/components/ImageUpload";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [club, setClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wikiData, setWikiData] = useState<WikiData>({});
  const [editingClub, setEditingClub] = useState<any>(null);

  // Tx form
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [txAmount, setTxAmount] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [txCat, setTxCat] = useState("");

  const canEdit = !!user && (isAdmin || (club && club.owner_id === user.id));

  const load = async () => {
    if (!id) return;
    const [{ data: c }, { data: p }, { data: t }] = await Promise.all([
      supabase.from("clubs").select("*").eq("id", id).maybeSingle(),
      supabase.from("players").select("*").eq("club_id", id),
      supabase.from("transactions").select("*").eq("club_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setClub(c);
    setPlayers(p || []);
    setTransactions(t || []);
    setWikiData((c?.wiki as WikiData) || {});
    setEditingClub(c);
    setLoading(false);
    if (c) document.title = `${c.name} — Solara Hub`;
  };

  useEffect(() => { load(); }, [id]);

  const saveWiki = async () => {
    const { error } = await supabase.from("clubs").update({ wiki: wikiData as any }).eq("id", id!);
    if (error) toast.error(error.message); else toast.success("Wiki atualizada!");
  };

  const saveClubInfo = async () => {
    const { error } = await supabase.from("clubs").update({
      name: editingClub.name,
      crest_url: editingClub.crest_url,
      city: editingClub.city,
      stadium_name: editingClub.stadium_name,
      stadium_capacity: parseInt(editingClub.stadium_capacity) || 0,
      primary_color: editingClub.primary_color,
      founded_year: parseInt(editingClub.founded_year) || null,
    }).eq("id", id!);
    if (error) toast.error(error.message); else { toast.success("Clube atualizado!"); load(); }
  };

  const toggleSale = async (playerId: string, value: boolean) => {
    const { error } = await supabase.from("players").update({ a_venda: value }).eq("id", playerId);
    if (error) return toast.error(error.message);
    setPlayers((prev) => prev.map((p) => p.id === playerId ? { ...p, a_venda: value } : p));
    toast.success(value ? "Jogador colocado à venda" : "Jogador removido da vitrine");
  };

  const addTransaction = async () => {
    if (!txAmount || !txDesc) { toast.error("Preencha valor e descrição"); return; }
    const { error } = await supabase.from("transactions").insert({
      club_id: id!, type: txType, amount: parseFloat(txAmount), description: txDesc, category: txCat || null, created_by: user!.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Transação registrada!");
    setTxAmount(""); setTxDesc(""); setTxCat("");
    load();
  };

  if (loading) return <div className="max-w-6xl mx-auto space-y-4"><Skeleton className="h-40" /><Skeleton className="h-80" /></div>;
  if (!club) return <div className="text-center py-20 text-muted-foreground">Clube não encontrado.</div>;

  const monthIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const monthExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const folhaSalarial = players.reduce((s, p) => s + Number(p.salario_atual || 0), 0);
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
  const patrocinio = Number(club.patrocinio_anual || 0);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Hero */}
      <Card className="p-6 md:p-8 bg-gradient-card border-border/50 overflow-hidden relative">
        <div className="absolute inset-0 opacity-20" style={club.primary_color ? { background: `radial-gradient(circle at top right, ${club.primary_color}, transparent 60%)` } : undefined} />
        <div className="relative flex flex-col md:flex-row gap-6 items-start md:items-center">
          <div className="h-24 w-24 md:h-32 md:w-32 flex items-center justify-center shrink-0">
            {club.crest_url ? <img src={club.crest_url} alt={club.name} className="h-full w-full object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]" /> : <Shield className="h-14 w-14 text-muted-foreground" />}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {canEdit && <Badge className="bg-primary text-primary-foreground">Você gerencia</Badge>}
              {club.founded_year && <Badge variant="outline">Fundado em {club.founded_year}</Badge>}
              {club.reputacao && <Badge variant="outline" className="capitalize">{club.reputacao}</Badge>}
              <Badge variant="outline" className="border-primary/40 text-primary">Rate {Number(club.rate ?? 2.8).toFixed(2)}</Badge>
            </div>
            <h1 className="text-3xl md:text-5xl font-bold">{club.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              {club.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {club.city}</span>}
              {club.stadium_name && <span className="flex items-center gap-1"><Building2 className="h-4 w-4" /> {club.stadium_name}</span>}
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {players.length} jogadores</span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs uppercase text-muted-foreground tracking-wider">Caixa Atual</div>
            <div className="text-3xl md:text-4xl font-display font-bold gold-text">{formatCurrency(Number(club.budget))}</div>
          </div>
        </div>
      </Card>

      <div className="stat-grid">
        <StatCard icon={Wallet} label="Receitas (recentes)" value={formatCurrency(monthIncome)} positive />
        <StatCard icon={TrendingDown} label="Despesas (recentes)" value={formatCurrency(monthExpense)} />
        <StatCard icon={Building2} label="Capacidade" value={(club.stadium_capacity || 0).toLocaleString("pt-BR")} />
        <StatCard icon={Users} label="Elenco" value={String(players.length)} />
      </div>

      <Tabs defaultValue="elenco" className="w-full">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="elenco">Elenco</TabsTrigger>
          <TabsTrigger value="financas">Finanças</TabsTrigger>
          <TabsTrigger value="wiki">Wiki</TabsTrigger>
          {canEdit && <TabsTrigger value="config">Configurações</TabsTrigger>}
        </TabsList>

        <TabsContent value="elenco" className="space-y-3 mt-4">
          {players.length === 0 ? (
            <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">Sem jogadores no elenco.</Card>
          ) : (
            <Card className="bg-gradient-card border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-16">#</TableHead>
                    <TableHead className="w-20">Pos.</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead className="w-20">Idade</TableHead>
                    <TableHead>Nacionalidade</TableHead>
                    <TableHead className="w-20 text-center">Overall</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {canEdit && <TableHead className="text-center w-24">À venda</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...players].sort((a, b) => {
                    const ai = POSITIONS.indexOf(a.position); const bi = POSITIONS.indexOf(b.position);
                    const av = ai === -1 ? 999 : ai; const bv = bi === -1 ? 999 : bi;
                    if (av !== bv) return av - bv;
                    return Number(b.market_value) - Number(a.market_value);
                  }).map((p) => {
                    const flag = flagUrl(p.nationality);
                    const shirt = p.attributes?.shirtNumber;
                    const overall = p.overall;
                    return (
                      <TableRow key={p.id} className={`border-border/50 ${p.a_venda ? "bg-primary/5" : ""}`}>
                        <TableCell className="font-mono text-muted-foreground">{shirt ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-bold border-primary/40 text-primary">{p.position}</Badge>
                        </TableCell>
                        <TableCell className="font-bold">
                          <div className="flex items-center gap-2">
                            {p.name}
                            {p.a_venda && <Tag className="h-3 w-3 text-primary" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{p.age ?? "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {flag && <img src={flag} alt={p.nationality} className="h-3.5 w-auto rounded-sm shadow-sm" loading="lazy" />}
                            <span className="text-sm">{p.nationality || "—"}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {overall ? <span className="font-display font-bold text-primary">{overall}</span> : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-display font-bold text-primary">{formatCurrency(Number(p.market_value))}</TableCell>
                        {canEdit && (
                          <TableCell className="text-center">
                            <Switch checked={!!p.a_venda} onCheckedChange={(v) => toggleSale(p.id, v)} />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="financas" className="space-y-4 mt-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Patrocínio anual</div>
              <div className="font-display font-bold text-success mt-1">{formatCurrency(patrocinio)}</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Premiação por posição</div>
              <div className="font-display font-bold text-success mt-1">{formatCurrency(premiacao)}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{club.posicao_ultima_temporada ? `${club.posicao_ultima_temporada}º na última temp.` : "sem posição definida"}</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Folha salarial (anual)</div>
              <div className="font-display font-bold text-destructive mt-1">{formatCurrency(folhaSalarial)}</div>
            </Card>
            <Card className="p-4 bg-gradient-card border-border/50">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Manutenção da base</div>
              <div className="font-display font-bold text-destructive mt-1">{formatCurrency((club.nivel_base || 1) * 300_000)}</div>
            </Card>
          </div>

          {canEdit && (
            <Card className="p-5 bg-gradient-card border-border/50">
              <h3 className="font-display font-bold mb-3 flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Nova Transação</h3>
              <div className="grid md:grid-cols-4 gap-3">
                <Select value={txType} onValueChange={(v) => setTxType(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Receita</SelectItem>
                    <SelectItem value="expense">Despesa</SelectItem>
                  </SelectContent>
                </Select>
                <Input type="number" step="0.01" placeholder="Valor (R$)" value={txAmount} onChange={(e) => setTxAmount(e.target.value)} />
                <Input placeholder="Categoria (opcional)" value={txCat} onChange={(e) => setTxCat(e.target.value)} />
                <Input placeholder="Descrição" value={txDesc} onChange={(e) => setTxDesc(e.target.value)} />
              </div>
              <Button onClick={addTransaction} className="mt-3 bg-gradient-gold text-primary-foreground hover:opacity-90">Registrar</Button>
            </Card>
          )}
          <div className="space-y-2">
            {transactions.length === 0 ? (
              <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">Sem transações registradas.</Card>
            ) : transactions.map((t) => (
              <Card key={t.id} className="p-3 bg-gradient-card border-border/50 flex items-center gap-3">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${t.type === "income" ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"}`}>
                  {t.type === "income" ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">{t.description}</div>
                  <div className="text-xs text-muted-foreground">{t.category || "—"} · {new Date(t.created_at).toLocaleString("pt-BR")}</div>
                </div>
                <div className={`font-display font-bold ${t.type === "income" ? "text-success" : "text-destructive"}`}>
                  {t.type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="wiki" className="mt-4 space-y-3">
          {canEdit ? (
            <>
              <WikiSectionsEditor wiki={wikiData} onChange={setWikiData} />
              <Button onClick={saveWiki} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
                <Save className="h-4 w-4" /> Salvar Wiki
              </Button>
            </>
          ) : (
            <WikiSectionsView wiki={wikiData} />
          )}
        </TabsContent>

        {canEdit && (
          <TabsContent value="config" className="mt-4">
            <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
              <h3 className="font-display font-bold">Editar Informações</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={editingClub?.name || ""} onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })} /></div>
                <div className="md:col-span-1"><Label>Escudo</Label><ImageUpload value={editingClub?.crest_url} onChange={(url) => setEditingClub({ ...editingClub, crest_url: url })} folder={id} /></div>
                <div><Label>Cidade</Label><Input value={editingClub?.city || ""} onChange={(e) => setEditingClub({ ...editingClub, city: e.target.value })} /></div>
                <div><Label>Estádio</Label><Input value={editingClub?.stadium_name || ""} onChange={(e) => setEditingClub({ ...editingClub, stadium_name: e.target.value })} /></div>
                <div><Label>Capacidade</Label><Input type="number" value={editingClub?.stadium_capacity || 0} onChange={(e) => setEditingClub({ ...editingClub, stadium_capacity: e.target.value })} /></div>
                <div><Label>Cor primária (hex)</Label><Input value={editingClub?.primary_color || ""} onChange={(e) => setEditingClub({ ...editingClub, primary_color: e.target.value })} placeholder="#ffbe1a" /></div>
                <div><Label>Ano de fundação</Label><Input type="number" value={editingClub?.founded_year || ""} onChange={(e) => setEditingClub({ ...editingClub, founded_year: e.target.value })} /></div>
              </div>
              <Button onClick={saveClubInfo} className="bg-gradient-gold text-primary-foreground hover:opacity-90"><Save className="h-4 w-4" /> Salvar</Button>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, positive }: any) => (
  <Card className="p-4 bg-gradient-card border-border/50">
    <div className="flex items-center gap-3">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${positive ? "bg-success/20 text-success" : "bg-primary/10 text-primary"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-display font-bold truncate">{value}</div>
      </div>
    </div>
  </Card>
);

export default ClubDetail;
