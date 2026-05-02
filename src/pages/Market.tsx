import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users,
  Search,
  Tag,
  ArrowRightLeft,
  Inbox,
  Send,
  AlertTriangle,
  LogIn,
  MessageSquare,
  History,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { formatCurrency, POSITIONS, calcStars } from "@/lib/format";
import { getFlagUrl } from "@/lib/countries";
import { StarRating } from "@/components/StarRating";
import { toast } from "sonner";

type TransferType = "compra" | "emprestimo" | "troca";

const Market = () => {
  const { user, loading, signInWithDiscord } = useAuth();
  const [players, setPlayers] = useState<any[]>([]);
  const [clubs, setClubs] = useState<Record<string, any>>({});
  const [myClubs, setMyClubs] = useState<any[]>([]);
  const [activeClubId, setActiveClubId] = useState<string>("");
  const [proposals, setProposals] = useState<any[]>([]);
  const [seasonTransfers, setSeasonTransfers] = useState<any[]>([]);
  const [rumores, setRumores] = useState<any[]>([]);
  const [temporadaAtual, setTemporadaAtual] = useState<number>(new Date().getFullYear());

  // filtros
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<string>("all");
  const [onlyForSale, setOnlyForSale] = useState(false);

  // proposta modal
  const [target, setTarget] = useState<any>(null);
  const [tipo, setTipo] = useState<TransferType>("compra");
  const [valor, setValor] = useState("");
  const [salario, setSalario] = useState("");
  const [luvas, setLuvas] = useState("");
  const [duracao, setDuracao] = useState("1");
  const [jogadorTrocado, setJogadorTrocado] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // contraproposta modal
  const [counterTarget, setCounterTarget] = useState<any>(null);
  const [cValor, setCValor] = useState("");
  const [cSalario, setCSalario] = useState("");
  const [cLuvas, setCLuvas] = useState("");

  useEffect(() => {
    document.title = "Mercado — Solara Hub";
  }, []);

  const loadAll = async () => {
    const [{ data: cs }, { data: ps }] = await Promise.all([
      supabase.from("clubs").select("id, name, crest_url, owner_id").order("name"),
      supabase.from("players").select("*"),
    ]);
    const map: Record<string, any> = {};
    (cs || []).forEach((c) => {
      map[c.id] = c;
    });
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
    if (!activeClubId) {
      setProposals([]);
      return;
    }
    const { data } = await supabase
      .from("transferencias")
      .select("*")
      .or(`clube_vendedor_id.eq.${activeClubId},clube_comprador_id.eq.${activeClubId}`)
      .order("created_at", { ascending: false });
    setProposals(data || []);
  };

  const loadSeasonAndRumors = async () => {
    // Temporada atual
    const { data: cfg } = await supabase.from("settings").select("value").eq("key", "temporada_atual").maybeSingle();
    const temp = Number((cfg?.value as any)?.ano) || new Date().getFullYear();
    setTemporadaAtual(temp);

    // Transferências aceitas (todas globais — usamos transactions categoria=transferencia tipo=entrada para deduplicar por op)
    const { data: tx } = await supabase
      .from("transactions")
      .select("*")
      .eq("categoria", "transferencia")
      .eq("tipo", "entrada")
      .eq("temporada", temp)
      .order("created_at", { ascending: false })
      .limit(200);
    setSeasonTransfers(tx || []);

    // Rumores: pendentes + aceitas/recusadas das últimas 48h
    const since = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
    const { data: rs } = await supabase
      .from("transferencias")
      .select("*")
      .or(`status.eq.pendente,and(status.in.(aceita,recusada,contraproposta),created_at.gte.${since})`)
      .order("created_at", { ascending: false })
      .limit(150);
    setRumores(rs || []);
  };

  useEffect(() => {
    loadAll();
    loadSeasonAndRumors();
  }, []);
  useEffect(() => {
    loadMine();
  }, [user]);
  useEffect(() => {
    loadProposals();
  }, [activeClubId]);

  // Vitrine pública: jogadores à venda + livres + filtros
  const filteredVitrine = useMemo(() => {
    return players
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) => pos === "all" || p.position === pos)
      .filter((p) => !onlyForSale || p.a_venda)
      .sort((a, b) => {
        if (a.a_venda !== b.a_venda) return a.a_venda ? -1 : 1;
        return Number(b.market_value || 0) - Number(a.market_value || 0);
      });
  }, [players, q, pos, onlyForSale]);

  // Negociar: só jogadores de OUTROS clubes
  const filteredNegociar = useMemo(() => {
    return players
      .filter((p) => p.club_id && p.club_id !== activeClubId)
      .filter((p) => !onlyForSale || p.a_venda)
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .filter((p) => pos === "all" || p.position === pos)
      .sort((a, b) => {
        if (a.a_venda !== b.a_venda) return a.a_venda ? -1 : 1;
        return Number(b.valor_base_calculado || 0) - Number(a.valor_base_calculado || 0);
      });
  }, [players, activeClubId, q, pos, onlyForSale]);

  const myPlayers = useMemo(() => players.filter((p) => p.club_id === activeClubId), [players, activeClubId]);

  const openProposal = async (player: any) => {
    setTarget(player);
    setTipo("compra");
    setValor(String(Math.round(Number(player.valor_base_calculado))));
    // Sugere salário coerente: 10% do valor base / ano (via RPC)
    let sugerido = Math.round(Number(player.valor_base_calculado || 0) * 0.1);
    try {
      const { data } = await supabase.rpc("sugerir_salario_jogador", { _jogador_id: player.id });
      if (data) sugerido = Math.round(Number(data));
    } catch {}
    setSalario(String(Math.max(50000, sugerido)));
    setLuvas("0");
    setDuracao("1");
    setJogadorTrocado("");
  };

  const fairPlayCheck = (v: number, base: number) => {
    if (!base) return "Jogador sem valor base";
    if (v < base * 0.5) return `Mínimo permitido: ${formatCurrency(base * 0.5)} (50%)`;
    if (v > base * 3.0) return `Máximo permitido: ${formatCurrency(base * 3.0)} (300%)`;
    return null;
  };

  const activeClub = myClubs.find((c) => c.id === activeClubId);
  const caixaComprador = Number(activeClub?.budget || 0);
  const valorNum = parseFloat(valor) || 0;
  const luvasNum = parseFloat(luvas) || 0;
  const totalDevido = valorNum + luvasNum;

  const fpError = target && tipo === "compra" ? fairPlayCheck(valorNum, Number(target.valor_base_calculado)) : null;
  const caixaError =
    target && totalDevido > caixaComprador
      ? `Caixa insuficiente: necessário ${formatCurrency(totalDevido)}, disponível ${formatCurrency(caixaComprador)}`
      : null;
  const trocaError = tipo === "troca" && !jogadorTrocado ? "Selecione um jogador para oferecer na troca" : null;

  const submit = async () => {
    if (!target || !activeClubId || !user) return;
    if (fpError) return toast.error(fpError);
    if (caixaError) return toast.error(caixaError);
    if (trocaError) return toast.error(trocaError);
    if (!salario || parseFloat(salario) < 0) return toast.error("Salário inválido");
    setSubmitting(true);
    const payload: any = {
      jogador_id: target.id,
      clube_comprador_id: activeClubId,
      clube_vendedor_id: target.club_id,
      valor_ofertado: tipo === "emprestimo" ? 0 : valorNum,
      salario_ofertado: parseFloat(salario),
      luvas: tipo === "compra" ? luvasNum : 0,
      tipo,
      created_by: user.id,
    };
    if (tipo === "troca") payload.jogador_trocado_id = jogadorTrocado;
    if (tipo === "emprestimo") payload.duracao_emprestimo = parseInt(duracao) || 1;

    const { error } = await supabase.from("transferencias").insert(payload);
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Proposta enviada!");
    setTarget(null);
    loadProposals();
    loadSeasonAndRumors();
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
    await Promise.all([loadAll(), loadProposals(), loadSeasonAndRumors()]);
  };

  const openCounter = (proposal: any) => {
    setCounterTarget(proposal);
    setCValor(String(Math.round(Number(proposal.valor_ofertado || 0))));
    setCSalario(String(Math.round(Number(proposal.salario_ofertado || 0))));
    setCLuvas(String(Math.round(Number(proposal.luvas || 0))));
  };

  const sendCounter = async () => {
    if (!counterTarget) return;
    const { error } = await supabase.rpc("criar_contraproposta", {
      _proposta_id: counterTarget.id,
      _valor: parseFloat(cValor) || 0,
      _salario: parseFloat(cSalario) || 0,
      _luvas: parseFloat(cLuvas) || 0,
    });
    if (error) return toast.error(error.message);
    toast.success("Contraproposta enviada!");
    setCounterTarget(null);
    loadProposals();
    loadSeasonAndRumors();
  };

  const inbox = useMemo(() => {
    // Propostas pendentes que VOCÊ precisa responder:
    // - normais (sem proposta_pai_id) onde você é vendedor
    // - contrapropostas (com proposta_pai_id) onde você é comprador
    return proposals.filter((p) => {
      if (p.status !== "pendente" && p.status !== "contraproposta") return false;
      const isCounter = !!p.proposta_pai_id;
      if (isCounter) return p.clube_comprador_id === activeClubId && p.status === "pendente";
      return p.clube_vendedor_id === activeClubId && p.status === "pendente";
    });
  }, [proposals, activeClubId]);

  const sent = useMemo(() => {
    // Propostas que VOCÊ enviou (qualquer status)
    return proposals.filter((p) => {
      const isCounter = !!p.proposta_pai_id;
      if (isCounter) return p.clube_vendedor_id === activeClubId; // contraproposta enviada pelo vendedor
      return p.clube_comprador_id === activeClubId;
    });
  }, [proposals, activeClubId]);

  const playerById = (id: string) => players.find((p) => p.id === id);
  const tipoLabel = (t: TransferType) => (t === "compra" ? "Compra" : t === "emprestimo" ? "Empréstimo" : "Troca");

  if (loading) return null;

  const forSaleCount = players.filter((p) => p.a_venda).length;
  const inboxCount = inbox.length;
  const hasClub = myClubs.length > 0;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Mercado da Bola</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Vitrine, rumores e negociações.{" "}
              <Badge variant="outline" className="border-primary/40 text-primary ml-1 text-[10px]">
                <Tag className="h-2.5 w-2.5 mr-1" />
                {forSaleCount} à venda
              </Badge>
            </p>
          </div>
        </div>
        {hasClub && myClubs.length > 1 && (
          <Select value={activeClubId} onValueChange={setActiveClubId}>
            <SelectTrigger className="md:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {myClubs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      <Tabs defaultValue="vitrine">
        <div className="-mx-3 sm:-mx-4 md:mx-0 overflow-x-auto scrollbar-thin">
          <TabsList className="bg-secondary/50 mx-3 sm:mx-4 md:mx-0 w-max">
            <TabsTrigger value="vitrine">
              <Tag className="h-3.5 w-3.5 mr-1" /> Vitrine
            </TabsTrigger>
            {hasClub && (
              <TabsTrigger value="negociar">
                <ArrowRightLeft className="h-3.5 w-3.5 mr-1" /> Negociar
              </TabsTrigger>
            )}
            <TabsTrigger value="rumores">
              <Radio className="h-3.5 w-3.5 mr-1" /> Rumores
            </TabsTrigger>
            <TabsTrigger value="temporada">
              <History className="h-3.5 w-3.5 mr-1" /> Transferências da Temporada
            </TabsTrigger>
            {hasClub && (
              <TabsTrigger value="inbox">
                <Inbox className="h-3.5 w-3.5 mr-1" />
                <span className="hidden sm:inline">Caixa de Entrada</span>
                <span className="sm:hidden">Inbox</span>
                {inboxCount > 0 && <Badge className="ml-2 bg-primary text-primary-foreground">{inboxCount}</Badge>}
              </TabsTrigger>
            )}
            {hasClub && (
              <TabsTrigger value="sent">
                <Send className="h-3.5 w-3.5 mr-1" /> Enviadas
              </TabsTrigger>
            )}
          </TabsList>
        </div>

        {/* VITRINE PÚBLICA - aparece pra todos */}
        <TabsContent value="vitrine" className="mt-4 space-y-3">
          <Filters
            q={q}
            setQ={setQ}
            pos={pos}
            setPos={setPos}
            onlyForSale={onlyForSale}
            setOnlyForSale={setOnlyForSale}
          />
          <div className="space-y-2">
            {filteredVitrine.map((p) => {
              const club = p.club_id ? clubs[p.club_id] : null;
              return (
                <Card
                  key={p.id}
                  className={`p-3 sm:p-4 bg-gradient-card border-border/50 transition-all ${p.a_venda ? "border-primary/40 shadow-gold/20" : ""}`}
                >
                  <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap">
                    <Badge
                      variant="outline"
                      className="font-bold w-12 sm:w-14 justify-center border-primary/40 text-primary shrink-0 text-xs"
                    >
                      {p.position}
                    </Badge>
                    <div className="flex-1 min-w-0 order-1 sm:order-none basis-full sm:basis-auto">
                      <div className="font-bold truncate flex items-center gap-2">
                        {p.name}
                        {p.a_venda && (
                          <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 shrink-0">
                            <Tag className="h-2.5 w-2.5 mr-0.5" />À VENDA
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                        {p.age ? `${p.age} anos` : ""}
                        {p.nationality && <FlagImg nationality={p.nationality} />}
                      </div>
                    </div>
                    {club ? (
                      <Link
                        to={`/clubes/${club.id}`}
                        className="flex items-center gap-2 text-xs hover:text-primary transition-colors shrink-0"
                      >
                        <div className="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center">
                          {club.crest_url && (
                            <img src={club.crest_url} alt={club.name} className="w-full h-full object-contain" />
                          )}
                        </div>
                        <span className="hidden md:inline">{club.name}</span>
                      </Link>
                    ) : (
                      <Badge variant="secondary" className="text-xs">
                        Sem clube
                      </Badge>
                    )}
                    <div className="text-right shrink-0 ml-auto sm:ml-0">
                      <div className="text-[10px] text-muted-foreground uppercase">Valor</div>
                      <div className="font-display font-bold text-primary text-sm sm:text-base">
                        {formatCurrency(Number(p.market_value))}
                      </div>
                    </div>
                    {p.a_venda && hasClub && p.club_id !== activeClubId && (
                      <Button
                        size="sm"
                        onClick={() => openProposal(p)}
                        className="bg-gradient-gold text-primary-foreground hover:opacity-90 shrink-0"
                      >
                        <ArrowRightLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Negociar</span>
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
            {filteredVitrine.length === 0 && (
              <Card className="p-12 text-center bg-gradient-card border-border/50 text-muted-foreground">
                Nenhum jogador encontrado.
              </Card>
            )}
            {!user && (
              <Card className="p-6 text-center bg-gradient-card border-primary/30 mt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Quer enviar propostas? Entre com Discord para acessar negociações.
                </p>
                <Button onClick={signInWithDiscord} className="bg-[#5865F2] hover:bg-[#4752c4] text-white">
                  <LogIn className="h-4 w-4" /> Entrar com Discord
                </Button>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* NEGOCIAR */}
        {hasClub && (
          <TabsContent value="negociar" className="space-y-3 mt-4">
            <Filters
              q={q}
              setQ={setQ}
              pos={pos}
              setPos={setPos}
              onlyForSale={onlyForSale}
              setOnlyForSale={setOnlyForSale}
            />
            <Card className="bg-gradient-card border-border/50 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-16">Posição</TableHead>
                    <TableHead>Jogador</TableHead>
                    <TableHead className="w-20 hidden sm:table-cell"></TableHead>
                    <TableHead>Clube</TableHead>
                    <TableHead className="text-center w-16">Overall</TableHead>
                    <TableHead className="text-center w-16 hidden sm:table-cell">Idade</TableHead>
                    <TableHead className="text-right">Valor base</TableHead>
                    <TableHead className="w-24"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredNegociar.map((p) => {
                    const club = clubs[p.club_id];
                    return (
                      <TableRow key={p.id} className={p.a_venda ? "bg-primary/5" : ""}>
                        <TableCell>
                          <Badge variant="outline" className="border-primary/40 text-primary">
                            {p.position}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{p.name}</span>
                            {p.a_venda && (
                              <Badge className="bg-primary/20 text-primary border-primary/40 text-[10px] px-1.5 py-0">
                                <Tag className="h-2.5 w-2.5 mr-0.5" />À VENDA
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell py-2">
                          {p.nationality && <FlagImg nationality={p.nationality} />}
                        </TableCell>
                        <TableCell>
                          {club ? (
                            <Link
                              to={`/clubes/${club.id}`}
                              className="flex items-center gap-2 hover:text-primary transition-colors"
                            >
                              <div className="h-7 w-7 shrink-0 flex items-center justify-center">
                                {club.crest_url && (
                                  <img src={club.crest_url} alt={club.name} className="w-full h-full object-contain" />
                                )}
                              </div>
                              <span className="text-sm hidden md:inline">{club.name}</span>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <StarRating value={calcStars(p.habilidade, club?.rate)} />
                        </TableCell>
                        <TableCell className="text-center hidden sm:table-cell text-sm">{p.age || "—"}</TableCell>
                        <TableCell className="text-right font-display font-bold text-primary">
                          {formatCurrency(Number(p.valor_base_calculado))}
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => openProposal(p)}
                            className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                          >
                            Negociar
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredNegociar.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Nenhum jogador disponível.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        )}

        {/* RUMORES */}
        <TabsContent value="rumores" className="space-y-2 mt-4">
          <Card className="p-3 bg-gradient-card border-border/50 text-xs text-muted-foreground flex items-center gap-2">
            <Radio className="h-4 w-4 text-primary" />
            Feed de propostas em andamento e movimentações recentes (últimas 48h).
          </Card>
          {rumores.length === 0 && (
            <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
              Sem movimentações no momento.
            </Card>
          )}
          {rumores.map((t) => {
            const player = players.find((p) => p.id === t.jogador_id);
            const comp = clubs[t.clube_comprador_id];
            const vend = clubs[t.clube_vendedor_id];
            const statusBadge =
              t.status === "pendente"
                ? { icon: Clock, cls: "bg-amber-500/20 text-amber-400 border-amber-500/40", label: "Em negociação" }
                : t.status === "aceita"
                  ? {
                      icon: CheckCircle2,
                      cls: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
                      label: "Acordo fechado",
                    }
                  : t.status === "contraproposta"
                    ? {
                        icon: MessageSquare,
                        cls: "bg-primary/20 text-primary border-primary/40",
                        label: "Contraproposta",
                      }
                    : {
                        icon: XCircle,
                        cls: "bg-destructive/20 text-destructive border-destructive/40",
                        label: "Recusada",
                      };
            const StatusIcon = statusBadge.icon;
            return (
              <Card key={t.id} className="p-3 sm:p-4 bg-gradient-card border-border/50">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline" className={`text-[10px] ${statusBadge.cls}`}>
                    <StatusIcon className="h-3 w-3 mr-1" /> {statusBadge.label}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                    {tipoLabel(t.tipo)}
                  </Badge>
                  {comp && (
                    <Link to={`/clubes/${comp.id}`} className="flex items-center gap-1.5 hover:text-primary">
                      <div className="h-6 w-6 flex items-center justify-center">
                        {comp.crest_url && (
                          <img src={comp.crest_url} alt={comp.name} className="w-full h-full object-contain" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{comp.name}</span>
                    </Link>
                  )}
                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-bold">{player?.name || "—"}</span>
                  <span className="text-xs text-muted-foreground">de</span>
                  {vend && (
                    <Link to={`/clubes/${vend.id}`} className="flex items-center gap-1.5 hover:text-primary">
                      <div className="h-6 w-6 flex items-center justify-center">
                        {vend.crest_url && (
                          <img src={vend.crest_url} alt={vend.name} className="w-full h-full object-contain" />
                        )}
                      </div>
                      <span className="text-sm font-medium">{vend.name}</span>
                    </Link>
                  )}
                  <div className="ml-auto text-right">
                    {t.tipo !== "emprestimo" && Number(t.valor_ofertado) > 0 && (
                      <div className="font-display font-bold text-primary text-sm">
                        {formatCurrency(Number(t.valor_ofertado))}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(t.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </TabsContent>

        {/* TRANSFERÊNCIAS DA TEMPORADA */}
        <TabsContent value="temporada" className="space-y-3 mt-4">
          <Card className="p-3 bg-gradient-card border-border/50 text-xs text-muted-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Negócios fechados na temporada {temporadaAtual} ({seasonTransfers.length}{" "}
            {seasonTransfers.length === 1 ? "operação" : "operações"}).
          </Card>
          <Card className="bg-gradient-card border-border/50 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Jogador</TableHead>
                  <TableHead className="w-12 hidden sm:table-cell"></TableHead>
                  <TableHead>De</TableHead>
                  <TableHead>Para</TableHead>
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {seasonTransfers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                      Nenhuma transferência registrada nesta temporada.
                    </TableCell>
                  </TableRow>
                )}
                {seasonTransfers.map((tx) => {
                  const player = players.find((p) => p.id === tx.related_player_id);
                  const compradorClub = clubs[tx.related_club_id];
                  const vendedorClub = clubs[tx.club_id];
                  const tipoOp = (tx.metadata as any)?.tipo_op || "compra";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="font-medium">{player?.name || tx.descricao}</TableCell>
                      <TableCell className="hidden sm:table-cell py-2">
                        {player?.nationality && <FlagImg nationality={player.nationality} />}
                      </TableCell>
                      <TableCell>
                        {vendedorClub ? (
                          <Link
                            to={`/clubes/${vendedorClub.id}`}
                            className="flex items-center gap-2 hover:text-primary"
                          >
                            <div className="h-6 w-6 shrink-0">
                              {vendedorClub.crest_url && (
                                <img src={vendedorClub.crest_url} className="w-full h-full object-contain" alt="" />
                              )}
                            </div>
                            <span className="text-sm hidden md:inline">{vendedorClub.name}</span>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        {compradorClub ? (
                          <Link
                            to={`/clubes/${compradorClub.id}`}
                            className="flex items-center gap-2 hover:text-primary"
                          >
                            <div className="h-6 w-6 shrink-0">
                              {compradorClub.crest_url && (
                                <img src={compradorClub.crest_url} className="w-full h-full object-contain" alt="" />
                              )}
                            </div>
                            <span className="text-sm hidden md:inline">{compradorClub.name}</span>
                          </Link>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="text-[10px] uppercase border-primary/40 text-primary">
                          {tipoOp}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-display font-bold text-primary">
                        {Number(tx.valor) > 0 ? (
                          formatCurrency(Number(tx.valor))
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* INBOX */}
        {hasClub && (
          <TabsContent value="inbox" className="space-y-2 mt-4">
            {inbox.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
                Nenhuma proposta para responder.
              </Card>
            )}
            {inbox.map((t) => {
              const player = playerById(t.jogador_id);
              const oferecido = t.jogador_trocado_id ? playerById(t.jogador_trocado_id) : null;
              const isCounter = !!t.proposta_pai_id;
              const fromClub = isCounter ? clubs[t.clube_vendedor_id] : clubs[t.clube_comprador_id];
              const base = Number(player?.valor_base_calculado || 0);
              return (
                <Card key={t.id} className="p-4 bg-gradient-card border-border/50">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isCounter && (
                        <Badge className="bg-primary/30 text-primary border-primary/50 text-[10px]">
                          <MessageSquare className="h-2.5 w-2.5 mr-1" />
                          CONTRAPROPOSTA
                        </Badge>
                      )}
                      <Badge variant="outline" className="border-primary/40 text-primary uppercase text-[10px]">
                        {tipoLabel(t.tipo)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {player?.position}
                      </Badge>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate">{player?.name || "Jogador"}</div>
                        <div className="text-xs text-muted-foreground">
                          {isCounter ? "Contraproposta de" : "Oferta de"} <strong>{fromClub?.name || "?"}</strong> ·
                          base {formatCurrency(base)}
                          {t.tipo === "emprestimo" && t.duracao_emprestimo && <> · {t.duracao_emprestimo} temp.</>}
                          {t.tipo === "troca" && oferecido && (
                            <>
                              {" "}
                              · oferece <strong>{oferecido.name}</strong>
                            </>
                          )}
                          {Number(t.luvas) > 0 && <> · luvas {formatCurrency(Number(t.luvas))}</>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-end justify-between gap-3 flex-wrap">
                      <div className="flex gap-4">
                        {t.tipo !== "emprestimo" && (
                          <div>
                            <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                            <div className="font-display font-bold text-primary text-sm">
                              {formatCurrency(Number(t.valor_ofertado))}
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="text-[10px] uppercase text-muted-foreground">Salário</div>
                          <div className="font-display font-bold text-sm">
                            {formatCurrency(Number(t.salario_ofertado))}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => respond(t.id, false)}>
                          Recusar
                        </Button>
                        {!isCounter && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openCounter(t)}
                            className="border-primary/40 text-primary hover:bg-primary/10"
                          >
                            <MessageSquare className="h-3.5 w-3.5" /> Contra-propor
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => respond(t.id, true)}
                          className="bg-gradient-gold text-primary-foreground hover:opacity-90"
                        >
                          Aceitar
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        )}

        {/* SENT */}
        {hasClub && (
          <TabsContent value="sent" className="space-y-2 mt-4">
            {sent.length === 0 && (
              <Card className="p-10 text-center text-muted-foreground bg-gradient-card border-border/50">
                Você ainda não enviou propostas.
              </Card>
            )}
            {sent.map((t) => {
              const player = playerById(t.jogador_id);
              const isCounter = !!t.proposta_pai_id;
              const otherClub = isCounter ? clubs[t.clube_comprador_id] : clubs[t.clube_vendedor_id];
              return (
                <Card key={t.id} className="p-4 bg-gradient-card border-border/50">
                  <div className="flex items-center gap-3 flex-wrap">
                    {isCounter && (
                      <Badge className="bg-primary/30 text-primary border-primary/50 text-[10px]">
                        <MessageSquare className="h-2.5 w-2.5 mr-1" />
                        CONTRAPROPOSTA
                      </Badge>
                    )}
                    <Badge variant="outline" className="border-primary/40 text-primary uppercase text-[10px]">
                      {tipoLabel(t.tipo)}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {player?.position}
                    </Badge>
                    <div className="flex-1 min-w-0 basis-full sm:basis-auto">
                      <div className="font-bold truncate">{player?.name || "Jogador"}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        Para <strong>{otherClub?.name || "?"}</strong>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase text-muted-foreground">Valor</div>
                      <div className="font-display font-bold text-primary text-sm">
                        {formatCurrency(Number(t.valor_ofertado))}
                      </div>
                    </div>
                    <Badge
                      variant={
                        t.status === "aceita" ? "default" : t.status === "recusada" ? "destructive" : "secondary"
                      }
                      className={t.status === "aceita" ? "bg-primary text-primary-foreground" : ""}
                    >
                      {t.status}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        )}
      </Tabs>

      {/* PROPOSAL MODAL */}
      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Negociar jogador</DialogTitle>
            <DialogDescription>
              {target && (
                <>
                  Por <strong>{target.name}</strong> · valor base {formatCurrency(Number(target.valor_base_calculado))}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {target && (
            <Tabs value={tipo} onValueChange={(v) => setTipo(v as TransferType)}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="compra">Compra</TabsTrigger>
                <TabsTrigger value="emprestimo">Empréstimo</TabsTrigger>
                <TabsTrigger value="troca">Troca</TabsTrigger>
              </TabsList>

              <TabsContent value="compra" className="space-y-3 mt-3">
                <div>
                  <Label>Valor da transferência (€)</Label>
                  <NumberInput
                    value={valor}
                    onChange={(v) => setValor(String(v))}
                    min={Math.round(Number(target.valor_base_calculado) * 0.5)}
                    max={Math.round(Number(target.valor_base_calculado) * 3.0)}
                  />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Faixa Fair Play: {formatCurrency(Number(target.valor_base_calculado) * 0.5)} –{" "}
                    {formatCurrency(Number(target.valor_base_calculado) * 3.0)}
                  </div>
                </div>
                <div>
                  <Label>Salário ofertado (€/ano)</Label>
                  <NumberInput value={salario} onChange={(v) => setSalario(String(v))} min={0} />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Sugerido: {formatCurrency(Math.round(Number(target.valor_base_calculado || 0) * 0.1))}/ano (10% do
                    valor base)
                  </div>
                </div>
                <div>
                  <Label>Luvas (€)</Label>
                  <NumberInput
                    value={luvas}
                    onChange={(v) => setLuvas(String(v))}
                    min={0}
                    max={Math.max(0, caixaComprador)}
                  />
                  <div className="text-[11px] text-muted-foreground mt-1">
                    Total à vista: <strong>{formatCurrency(totalDevido)}</strong> · Caixa:{" "}
                    {formatCurrency(caixaComprador)}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="emprestimo" className="space-y-3 mt-3">
                <div>
                  <Label>Duração (temporadas)</Label>
                  <NumberInput
                    value={duracao}
                    onChange={(v) => setDuracao(String(v))}
                    min={1}
                    max={3}
                    thousands={false}
                  />
                </div>
                <div>
                  <Label>Salário pago pelo empréstimo (€/ano)</Label>
                  <NumberInput value={salario} onChange={(v) => setSalario(String(v))} min={0} />
                </div>
              </TabsContent>

              <TabsContent value="troca" className="space-y-3 mt-3">
                <div>
                  <Label>Jogador que você oferece</Label>
                  <Select value={jogadorTrocado} onValueChange={setJogadorTrocado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione do seu elenco..." />
                    </SelectTrigger>
                    <SelectContent>
                      {myPlayers.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.position} · {p.name} ({formatCurrency(Number(p.valor_base_calculado))})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Diferença em dinheiro (€) — opcional</Label>
                  <NumberInput value={valor} onChange={(v) => setValor(String(v))} min={0} />
                </div>
                <div>
                  <Label>Salário ofertado ao jogador-alvo (€/ano)</Label>
                  <NumberInput value={salario} onChange={(v) => setSalario(String(v))} min={0} />
                </div>
              </TabsContent>

              {fpError && (
                <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {fpError}
                </div>
              )}
              {caixaError && !fpError && (
                <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {caixaError}
                </div>
              )}
              {trocaError && (
                <div className="flex items-start gap-2 p-3 mt-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" /> {trocaError}
                </div>
              )}
            </Tabs>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={!!fpError || !!caixaError || !!trocaError || submitting}
              className="bg-gradient-gold text-primary-foreground hover:opacity-90"
            >
              {submitting ? "Enviando..." : "Enviar proposta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CONTRAPROPOSTA MODAL */}
      <Dialog open={!!counterTarget} onOpenChange={(o) => !o && setCounterTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Enviar contraproposta
            </DialogTitle>
            <DialogDescription>
              Edite os valores e devolva. A proposta original será encerrada e a nova vai pra caixa de entrada do
              comprador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Valor da transferência (€)</Label>
              <NumberInput value={cValor} onChange={(v) => setCValor(String(v))} min={0} />
            </div>
            <div>
              <Label>Salário (€/ano)</Label>
              <NumberInput value={cSalario} onChange={(v) => setCSalario(String(v))} min={0} />
            </div>
            <div>
              <Label>Luvas (€)</Label>
              <NumberInput value={cLuvas} onChange={(v) => setCLuvas(String(v))} min={0} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCounterTarget(null)}>
              Cancelar
            </Button>
            <Button onClick={sendCounter} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
              Enviar contraproposta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

function FlagImg({ nationality }: { nationality: string }) {
  const url = getFlagUrl(nationality);
  if (!url) return null;
  return (
    <img
      src={url}
      alt={nationality}
      title={nationality}
      className="h-6 w-8 object-cover rounded-sm shrink-0"
      style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.1)" }}
    />
  );
}

interface FiltersProps {
  q: string;
  setQ: (s: string) => void;
  pos: string;
  setPos: (s: string) => void;
  onlyForSale: boolean;
  setOnlyForSale: (v: boolean | ((p: boolean) => boolean)) => void;
}
const Filters = ({ q, setQ, pos, setPos, onlyForSale, setOnlyForSale }: FiltersProps) => (
  <div className="flex flex-col sm:flex-row gap-3">
    <div className="relative flex-1">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar jogador..." className="pl-10" />
    </div>
    <div className="flex gap-3">
      <Select value={pos} onValueChange={setPos}>
        <SelectTrigger className="flex-1 sm:w-48">
          <SelectValue placeholder="Posição" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas posições</SelectItem>
          {POSITIONS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={onlyForSale ? "default" : "outline"}
        onClick={() => setOnlyForSale((v) => !v)}
        className={onlyForSale ? "bg-gradient-gold text-primary-foreground shrink-0" : "shrink-0"}
      >
        <Tag className="h-4 w-4" />{" "}
        <span className="hidden sm:inline">{onlyForSale ? "Mostrando à venda" : "Só à venda"}</span>
      </Button>
    </div>
  </div>
);

export default Market;
