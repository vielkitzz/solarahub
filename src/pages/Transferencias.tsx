import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowRightLeft, Inbox, Send, AlertTriangle, LogIn, Search } from "lucide-react";
import { formatCurrency, POSITIONS } from "@/lib/format";
import { toast } from "sonner";
import { Link } from "react-router-dom";

const Transferencias = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [activeClubId, setActiveClubId] = useState<string>("");
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<Record<string, any>>({});
  const [proposals, setProposals] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("all");

  // proposal modal
  const [target, setTarget] = useState<any>(null);
  const [valor, setValor] = useState("");
  const [salario, setSalario] = useState("");
  const [luvas, setLuvas] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { document.title = "Transferências — Solara Hub"; }, []);

  const loadAll = async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("clubs").select("*").order("name"),
      supabase.from("players").select("*"),
    ]);
    const map: Record<string, any> = {};
    (cs || []).forEach((c) => { map[c.id] = c; });
    setClubs(map);
    setPlayers(ps || []);
  };

  const loadMine = async () => {
    if (!user) return;
    const { data } = await supabase.from("clubs").select("*").eq("owner_id", user.id);
    setMyClubs(data || []);
    if (data && data.length && !activeClubId) setActiveClubId(data[0].id);
  };

  const loadProposals = async () => {
    if (!activeClubId) { setProposals([]); return; }
    const { data } = await supabase
      .from("transferencias")
      .select("*")
      .or(`clube_vendedor_id.eq.${activeClubId},clube_comprador_id.eq.${activeClubId}`)
      .order("created_at", { ascending: false });
    setProposals(data || []);
  };

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { loadMine(); }, [user]);
  useEffect(() => { loadProposals(); }, [activeClubId]);

  const filtered = useMemo(() => {
    return players
      .filter((p) => p.club_id && p.club_id !== activeClubId)
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) => pos === "all" || p.position === pos)
      .sort((a, b) => Number(b.valor_base_calculado || 0) - Number(a.valor_base_calculado || 0));
  }, [players, activeClubId, q, pos]);

  const openProposal = (player: any) => {
    setTarget(player);
    setValor(String(Math.round(Number(player.valor_base_calculado))));
    setSalario(String(Math.round(Number(player.salario_atual))));
    setLuvas("0");
  };

  const activeClub = myClubs.find((c) => c.id === activeClubId);
  const caixaComprador = Number(activeClub?.budget || 0);

  const fairPlayCheck = (v: number, base: number) => {
    if (!base) return "Jogador sem valor base";
    if (v < base * 0.5) return `Mínimo permitido: ${formatCurrency(base * 0.5)} (50%)`;
    if (v > base * 3.0) return `Máximo permitido: ${formatCurrency(base * 3.0)} (300%)`;
    return null;
  };

  const valorNum = parseFloat(valor) || 0;
  const luvasNum = parseFloat(luvas) || 0;
  const totalDevido = valorNum + luvasNum;
  const fpError = target ? fairPlayCheck(valorNum, Number(target.valor_base_calculado)) : null;
  const caixaError = target && totalDevido > caixaComprador
    ? `Caixa insuficiente: necessário ${formatCurrency(totalDevido)}, disponível ${formatCurrency(caixaComprador)}`
    : null;

  const submit = async () => {
    if (!target || !activeClubId || !user) return;
    if (fpError) return toast.error(fpError);
    if (caixaError) return toast.error(caixaError);
    if (!salario || parseFloat(salario) < 0) return toast.error("Salário inválido");
    setSubmitting(true);
    const { error } = await supabase.from("transferencias").insert({
      jogador_id: target.id,
      clube_comprador_id: activeClubId,
      clube_vendedor_id: target.club_id,
      valor_ofertado: valorNum,
      salario_ofertado: parseFloat(salario),
      luvas: luvasNum,
      created_by: user.id,
    });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Proposta enviada!");
    setTarget(null);
    loadProposals();
  };

  const respond = async (id: string, accept: boolean) => {
    if (accept) {
      const { error } = await supabase.rpc("accept_transfer", { _transfer_id: id });
      if (error) return toast.error(error.message);
      toast.success("Transferência concluída!");
    } else {
      const { error } = await supabase.from("transferencias").update({ status: "recusada" }).eq("id", id);
      if (error) return toast.error(error.message);
      toast.success("Proposta recusada");
    }
    await Promise.all([loadAll(), loadProposals()]);
  };

  if (loading) return null;
  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center space-y-4">
        <h1 className="text-3xl font-bold">Mercado de Transferências</h1>
        <p className="text-muted-foreground">Entre com Discord para enviar e receber propostas.</p>
        <Button onClick={signInWithDiscord} className="bg-[#5865F2] hover:bg-[#4752c4] text-white">
          <LogIn className="h-4 w-4" /> Entrar com Discord
        </Button>
      </div>
    );
  }

  if (myClubs.length === 0) {
    return (
      <Card className="max-w-lg mx-auto mt-20 p-8 text-center bg-gradient-card border-border/50">
        <ArrowRightLeft className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
        <h2 className="font-display font-bold text-xl mb-2">Você precisa ter um clube</h2>
        <p className="text-muted-foreground text-sm">Peça a um admin para vincular seu Discord ID a um clube.</p>
      </Card>
    );
  }

  const inbox = proposals.filter((p) => p.clube_vendedor_id === activeClubId);
  const sent = proposals.filter((p) => p.clube_comprador_id === activeClubId);
  const playerById = (id: string) => players.find((p) => p.id === id);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Transferências</h1>
            <p className="text-sm text-muted-foreground">Mercado de propostas e caixa de entrada do seu clube.</p>
          </div>
        </div>
        {myClubs.length > 1 && (
          <Select value={activeClubId} onValueChange={setActiveClubId}>
            <SelectTrigger className="md:w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              {myClubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </header>

      <Tabs defaultValue="market">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="market"><Search className="h-3.5 w-3.5 mr-1" /> Mercado</TabsTrigger>
          <TabsTrigger value="inbox"><Inbox className="h-3.5 w-3.5 mr-1" /> Caixa de Entrada {inbox.filter(p => p.status === 'pendente').length > 0 && <Badge className="ml-2 bg-primary text-primary-foreground">{inbox.filter(p => p.status === 'pendente').length}</Badge>}</TabsTrigger>
          <TabsTrigger value="sent"><Send className="h-3.5 w-3.5 mr-1" /> Enviadas</TabsTrigger>
        </TabsList>

        {/* MERCADO */}
        <TabsContent value="market" className="space-y-3 mt-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
            </div>
            <Select value={pos} onValueChange={setPos}>
              <SelectTrigger className="md:w-48"><SelectValue placeholder="Posição" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas posições</SelectItem>
                {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-16">Pos.</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead className="hidden md:table-cell">Clube</TableHead>
                  <TableHead className="text-center w-16">OVR</TableHead>
                  <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
                  <TableHead className="text-right">Valor base</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => {
                  const club = clubs[p.club_id];
                  return (
                    <TableRow key={p.id}>
                      <TableCell><Badge variant="outline" className="border-primary/40 text-primary">{p.position}</Badge></TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {club && <Link to={`/clubes/${club.id}`} className="hover:text-primary">{club.name}</Link>}
                      </TableCell>
                      <TableCell className="text-center font-bold">{p.overall ?? "—"}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell text-sm">{p.age || "—"}</TableCell>
                      <TableCell className="text-right font-display font-bold text-primary">{formatCurrency(Number(p.valor_base_calculado))}</TableCell>
                      <TableCell><Button size="sm" onClick={() => openProposal(p)} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Propor</Button></TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">Nenhum jogador disponível.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* INBOX */}
        <TabsContent value="inbox" className="space-y-2 mt-4">
          {inbox.length === 0 && <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">Nenhuma proposta recebida.</Card>}
          {inbox.map((t) => {
            const player = playerById(t.jogador_id);
            const buyer = clubs[t.clube_comprador_id];
            const base = Number(player?.valor_base_calculado || 0);
            return (
              <Card key={t.id} className="p-4 bg-gradient-card border-border/50">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="border-primary/40 text-primary">{player?.position}</Badge>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-bold">{player?.name || "Jogador"}</div>
                    <div className="text-xs text-muted-foreground">Oferta de <strong>{buyer?.name || "?"}</strong> · base {formatCurrency(base)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                    <div className="font-display font-bold text-primary">{formatCurrency(Number(t.valor_ofertado))}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">Salário</div>
                    <div className="font-display font-bold">{formatCurrency(Number(t.salario_ofertado))}</div>
                  </div>
                  {t.status === "pendente" ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => respond(t.id, false)}>Recusar</Button>
                      <Button size="sm" onClick={() => respond(t.id, true)} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Aceitar</Button>
                    </div>
                  ) : (
                    <Badge variant={t.status === "aceita" ? "default" : "secondary"} className={t.status === "aceita" ? "bg-primary text-primary-foreground" : ""}>{t.status}</Badge>
                  )}
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* SENT */}
        <TabsContent value="sent" className="space-y-2 mt-4">
          {sent.length === 0 && <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">Você ainda não enviou propostas.</Card>}
          {sent.map((t) => {
            const player = playerById(t.jogador_id);
            const seller = clubs[t.clube_vendedor_id];
            return (
              <Card key={t.id} className="p-4 bg-gradient-card border-border/50">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="border-primary/40 text-primary">{player?.position}</Badge>
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-bold">{player?.name || "Jogador"}</div>
                    <div className="text-xs text-muted-foreground">Para <strong>{seller?.name || "?"}</strong></div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                    <div className="font-display font-bold text-primary">{formatCurrency(Number(t.valor_ofertado))}</div>
                  </div>
                  <Badge variant={t.status === "aceita" ? "default" : t.status === "recusada" ? "destructive" : "secondary"} className={t.status === "aceita" ? "bg-primary text-primary-foreground" : ""}>{t.status}</Badge>
                </div>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* PROPOSAL MODAL */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar proposta</DialogTitle>
            <DialogDescription>
              {target && <>Por <strong>{target.name}</strong> · OVR {target.overall} · valor base {formatCurrency(Number(target.valor_base_calculado))}</>}
            </DialogDescription>
          </DialogHeader>
          {target && (
            <div className="space-y-3">
              <div>
                <Label>Valor da transferência (€)</Label>
                <Input type="number" value={valor} onChange={(e) => setValor(e.target.value)} />
                <div className="text-[11px] text-muted-foreground mt-1">
                  Faixa Fair Play: {formatCurrency(Number(target.valor_base_calculado) * 0.5)} – {formatCurrency(Number(target.valor_base_calculado) * 3.0)}
                </div>
              </div>
              <div>
                <Label>Salário ofertado (€)</Label>
                <Input type="number" value={salario} onChange={(e) => setSalario(e.target.value)} />
              </div>
              <div>
                <Label>Luvas / bônus de assinatura (€)</Label>
                <Input type="number" value={luvas} onChange={(e) => setLuvas(e.target.value)} />
                <div className="text-[11px] text-muted-foreground mt-1">
                  Total a pagar à vista: <strong>{formatCurrency(totalDevido)}</strong> · Caixa do {activeClub?.name || "clube"}: {formatCurrency(caixaComprador)}
                </div>
              </div>
              {fpError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {fpError}
                </div>
              )}
              {caixaError && !fpError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {caixaError}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancelar</Button>
            <Button onClick={submit} disabled={!!fpError || !!caixaError || submitting} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              {submitting ? "Enviando..." : "Enviar proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Transferencias;
