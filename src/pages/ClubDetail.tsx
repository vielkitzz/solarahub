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
import { Shield, MapPin, Users, Wallet, Building2, TrendingUp, TrendingDown, Save, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { RichEditor } from "@/components/RichEditor";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const ClubDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user, isAdmin } = useAuth();
  const [club, setClub] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [wikiContent, setWikiContent] = useState("");
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
      supabase.from("players").select("*").eq("club_id", id).order("market_value", { ascending: false }),
      supabase.from("transactions").select("*").eq("club_id", id).order("created_at", { ascending: false }).limit(50),
    ]);
    setClub(c);
    setPlayers(p || []);
    setTransactions(t || []);
    setWikiContent((c?.wiki as any)?.content || "");
    setEditingClub(c);
    setLoading(false);
    if (c) document.title = `${c.name} — Solara Hub`;
  };

  useEffect(() => { load(); }, [id]);

  const saveWiki = async () => {
    const { error } = await supabase.from("clubs").update({ wiki: { content: wikiContent } }).eq("id", id!);
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
          ) : players.map((p) => (
            <Card key={p.id} className="p-4 bg-gradient-card border-border/50 flex items-center gap-4">
              <Badge variant="outline" className="font-bold w-14 justify-center border-primary/40 text-primary">{p.position}</Badge>
              <div className="flex-1">
                <div className="font-bold">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.age ? `${p.age} anos` : ""} {p.nationality && `· ${p.nationality}`}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Valor</div>
                <div className="font-display font-bold text-primary">{formatCurrency(Number(p.market_value))}</div>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="financas" className="space-y-4 mt-4">
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

        <TabsContent value="wiki" className="mt-4">
          <Card className="p-5 bg-gradient-card border-border/50">
            {canEdit ? (
              <>
                <RichEditor content={wikiContent} onChange={setWikiContent} />
                <Button onClick={saveWiki} className="mt-3 bg-gradient-gold text-primary-foreground hover:opacity-90">
                  <Save className="h-4 w-4" /> Salvar Wiki
                </Button>
              </>
            ) : (
              <RichEditor content={wikiContent} onChange={() => {}} editable={false} />
            )}
          </Card>
        </TabsContent>

        {canEdit && (
          <TabsContent value="config" className="mt-4">
            <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
              <h3 className="font-display font-bold">Editar Informações</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div><Label>Nome</Label><Input value={editingClub?.name || ""} onChange={(e) => setEditingClub({ ...editingClub, name: e.target.value })} /></div>
                <div><Label>URL do escudo</Label><Input value={editingClub?.crest_url || ""} onChange={(e) => setEditingClub({ ...editingClub, crest_url: e.target.value })} /></div>
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
