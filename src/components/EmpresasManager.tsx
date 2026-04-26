import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Building2, Save } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";

export const EmpresasManager = () => {
  const [empresas, setEmpresas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newBudget, setNewBudget] = useState("");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "empresas")
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar empresas");
    } else if (data) {
      setEmpresas(data.value as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const saveEmpresas = async (newList: any[]) => {
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "empresas", value: newList }, { onConflict: "key" });

    if (error) {
      toast.error("Erro ao salvar empresas");
      return false;
    }
    setEmpresas(newList);
    return true;
  };

  const addEmpresa = async () => {
    if (!newName || !newBudget) return toast.error("Preencha todos os campos");
    const newEmpresa = {
      id: crypto.randomUUID(),
      name: newName,
      budget: parseFloat(newBudget),
      created_at: new Date().toISOString(),
    };
    const newList = [...empresas, newEmpresa];
    if (await saveEmpresas(newList)) {
      toast.success("Empresa adicionada!");
      setNewName("");
      setNewBudget("");
    }
  };

  const removeEmpresa = async (id: string) => {
    if (!confirm("Remover esta empresa?")) return;
    const newList = empresas.filter((e) => e.id !== id);
    if (await saveEmpresas(newList)) {
      toast.success("Empresa removida");
    }
  };

  return (
    <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className="h-5 w-5 text-primary" />
        <h3 className="font-display font-bold text-lg">Gerenciar Empresas / Patrocinadores</h3>
      </div>

      <div className="grid md:grid-cols-3 gap-3 items-end bg-secondary/20 p-4 rounded-xl border border-border/50">
        <div className="space-y-2">
          <Label>Nome da Empresa</Label>
          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: Fly Emirates" />
        </div>
        <div className="space-y-2">
          <Label>Orçamento Disponível (€)</Label>
          <Input type="number" value={newBudget} onChange={(e) => setNewBudget(e.target.value)} placeholder="0" />
        </div>
        <Button onClick={addEmpresa} className="bg-gradient-gold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" /> Adicionar
        </Button>
      </div>

      <div className="space-y-2">
        {loading ? (
          <p className="text-center py-4 text-muted-foreground">Carregando...</p>
        ) : empresas.length === 0 ? (
          <p className="text-center py-4 text-muted-foreground">Nenhuma empresa cadastrada.</p>
        ) : (
          empresas.map((e) => (
            <div key={e.id} className="flex items-center gap-3 p-3 bg-secondary/30 rounded-lg border border-border/50">
              <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate">{e.name}</div>
                <div className="text-xs text-muted-foreground">Adicionado em {new Date(e.created_at).toLocaleDateString()}</div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-primary">{formatCurrency(e.budget)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => removeEmpresa(e.id)} className="text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
