import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Settings, Star, Hash } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const Configuracoes = () => {
  const { user, signInWithDiscord } = useAuth();
  const { prefs, loading, update } = useUserPreferences();

  useEffect(() => { document.title = "Configurações — Solara Hub"; }, []);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card className="p-8 text-center bg-gradient-card border-border/50 space-y-3">
          <Settings className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Entre para acessar suas configurações.</p>
          <button onClick={signInWithDiscord} className="text-primary underline text-sm">Entrar com Discord</button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <header className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Configurações Gerais</h1>
          <p className="text-sm text-muted-foreground">Personalize como o sistema exibe informações.</p>
        </div>
      </header>

      <Card className="p-5 bg-gradient-card border-border/50 space-y-4">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-primary" />
          <h2 className="font-display font-bold">Exibição de atributos</h2>
        </div>
        <p className="text-xs text-muted-foreground -mt-2">
          Por padrão, qualidades e potenciais são mostrados como estrelas. Ative para ver os valores numéricos
          exatos quando você for o dono do clube ou tiver olheiro.
        </p>

        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-primary" /> Habilidade como número
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Mostra a habilidade real (45-99) em vez de estrelas no elenco do seu clube.
                </p>
              </div>
              <Switch
                checked={prefs.show_numeric_skill}
                onCheckedChange={(v) => update({ show_numeric_skill: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Hash className="h-3.5 w-3.5 text-primary" /> Potencial como número
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Mostra a faixa numérica de potencial estimado em vez de estrelas.
                </p>
              </div>
              <Switch
                checked={prefs.show_numeric_potential}
                onCheckedChange={(v) => update({ show_numeric_potential: v })}
              />
            </div>
          </div>
        )}

        <div className="text-[10px] text-muted-foreground border-t border-border/40 pt-3">
          Estas preferências afetam apenas suas próprias visualizações e não interferem no Painel de Admin.
        </div>
      </Card>
    </div>
  );
};

export default Configuracoes;
