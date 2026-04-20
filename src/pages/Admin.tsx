import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Plus, ArrowRightLeft } from "lucide-react";
import { POSITIONS, formatCurrency } from "@/lib/format";
import { toast } from "sonner";

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [clubs, setClubs] = useState<any[]>([]);
  const [players, setPlayers] = useState<any[]>([]);

  // create club
  const [cName, setCName] = useState("");
  const [cCrest, setCCrest] = useState("");
  const [cDiscordId, setCDiscordId] = useState("");
  const [cCity, setCCity] = useState("");
  const [cStadium, setCStadium] = useState("");
  const [cCapacity, setCCapacity] = useState("");
  const [cBudget, setCBudget] = useState("");
  const [cColor, setCColor] = useState("");

  // create player
  const [pName, setPName] = useState("");
  const [pPos, setPPos] = useState("ATA");
  const [pClub, setPClub] = useState<string>("none");
  const [pValue, setPValue] = useState("");
  const [pAge, setPAge] = useState("");
  const [pNat, setPNat] = useState("");

  // transfer
  const [tPlayer, setTPlayer] = useState<string>("");
  const [tNewClub, setTNewClub] = useState<string>("none");
  const [tFee, setTFee] = useState("");

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
      if (!owner_id) toast.warning("Esse Discord ID ainda não fez login. O dono será vinculado quando ele entrar — por enquanto salvamos só o discord_id.");
    }
    const { error } = await supabase.from("clubs").insert({
      name: cName, crest_url: cCrest || null, owner_id, owner_discord_id: cDiscordId || null,
      city: cCity || null, stadium_name: cStadium || null,
      stadium_capacity: parseInt(cCapacity) || 0, budget: parseFloat(cBudget) || 0,
      primary_color: cColor || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Clube criado!");
    setCName(""); setCCrest(""); setCDiscordId(""); setCCity(""); setCStadium(""); setCCapacity(""); setCBudget(""); setCColor("");
    load();
  };

  const createPlayer = async () => {
    if (!pName) return toast.error("Nome obrigatório");
    const { error } = await supabase.from("players").insert({
      name: pName, position: pPos, club_id: pClub === "none" ? null : pClub,
      market_value: parseFloat(pValue) || 0, age: parseInt(pAge) || null, nationality: pNat || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Jogador criado!");
    setPName(""); setPValue(""); setPAge(""); setPNat("");
    load();
  };

  const transferPlayer = async () => {
    if (!tPlayer) return toast.error("Selecione um jogador");
    const newClubId = tNewClub === "none" ? null : tNewClub;
    const { error } = await supabase.from("players").update({ club_id: newClubId }).eq("id", tPlayer);
    if (error) return toast.error(error.message);
    // optional fee
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

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <header className="flex items-center gap-3">
        <Settings className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Painel do Administrador</h1>
          <p className="text-sm text-muted-foreground">Crie clubes, jogadores e gerencie transferências.</p>
        </div>
      </header>

      <Tabs defaultValue="clubs">
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="clubs">Clubes</TabsTrigger>
          <TabsTrigger value="players">Jogadores</TabsTrigger>
          <TabsTrigger value="transfer">Transferências</TabsTrigger>
        </TabsList>

        <TabsContent value="clubs" className="space-y-4 mt-4">
          <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
            <h3 className="font-display font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Novo Clube</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={cName} onChange={(e) => setCName(e.target.value)} /></div>
              <div><Label>Discord ID do dono</Label><Input value={cDiscordId} onChange={(e) => setCDiscordId(e.target.value)} placeholder="ex: 858559322370998343" /></div>
              <div><Label>URL do escudo</Label><Input value={cCrest} onChange={(e) => setCCrest(e.target.value)} /></div>
              <div><Label>Cidade</Label><Input value={cCity} onChange={(e) => setCCity(e.target.value)} /></div>
              <div><Label>Estádio</Label><Input value={cStadium} onChange={(e) => setCStadium(e.target.value)} /></div>
              <div><Label>Capacidade</Label><Input type="number" value={cCapacity} onChange={(e) => setCCapacity(e.target.value)} /></div>
              <div><Label>Orçamento inicial</Label><Input type="number" value={cBudget} onChange={(e) => setCBudget(e.target.value)} /></div>
              <div><Label>Cor primária (hex)</Label><Input value={cColor} onChange={(e) => setCColor(e.target.value)} placeholder="#ffbe1a" /></div>
            </div>
            <Button onClick={createClub} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Criar Clube</Button>
          </Card>

          <div className="space-y-2">
            {clubs.map((c) => (
              <Card key={c.id} className="p-3 bg-gradient-card border-border/50 flex items-center justify-between">
                <div className="font-medium">{c.name} <span className="text-xs text-muted-foreground">· {c.owner_discord_id || "sem dono"}</span></div>
                <div className="text-sm text-primary font-bold">{formatCurrency(Number(c.budget))}</div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="players" className="space-y-4 mt-4">
          <Card className="p-5 bg-gradient-card border-border/50 space-y-3">
            <h3 className="font-display font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Novo Jogador</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div><Label>Nome *</Label><Input value={pName} onChange={(e) => setPName(e.target.value)} /></div>
              <div><Label>Posição</Label>
                <Select value={pPos} onValueChange={setPPos}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Clube</Label>
                <Select value={pClub} onValueChange={setPClub}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem clube</SelectItem>
                    {clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Valor de mercado</Label><Input type="number" value={pValue} onChange={(e) => setPValue(e.target.value)} /></div>
              <div><Label>Idade</Label><Input type="number" value={pAge} onChange={(e) => setPAge(e.target.value)} /></div>
              <div><Label>Nacionalidade</Label><Input value={pNat} onChange={(e) => setPNat(e.target.value)} /></div>
            </div>
            <Button onClick={createPlayer} className="bg-gradient-gold text-primary-foreground hover:opacity-90">Criar Jogador</Button>
          </Card>

          <div className="space-y-1 max-h-96 overflow-auto">
            {players.map((p: any) => (
              <Card key={p.id} className="p-2 px-3 bg-gradient-card border-border/50 flex items-center justify-between text-sm">
                <span><span className="text-primary font-bold mr-2">{p.position}</span>{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.clubs?.name || "Sem clube"}</span>
              </Card>
            ))}
          </div>
        </TabsContent>

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
    </div>
  );
};

export default Admin;
