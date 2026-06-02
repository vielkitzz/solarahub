import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Eye, ShieldUser, Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ToggleProps {
  settingKey: string;
  title: string;
  description: string;
  icon: React.ElementType;
}

const VisibilityToggle = ({ settingKey, title, description, icon: Icon }: ToggleProps) => {
  const [visible, setVisible] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle()
      .then(({ data }) => {
        const v: any = data?.value;
        setVisible(v?.visible !== false);
        setLoading(false);
      });
  }, [settingKey]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: settingKey, value: { visible: next } as any }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    setVisible(next);
    toast.success(next ? `${title} visível` : `${title} oculta`);
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 text-primary mt-0.5" />
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-[11px] text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Label className="text-xs">{visible ? "Visível" : "Oculta"}</Label>
        <Switch checked={visible} onCheckedChange={toggle} disabled={loading || saving} />
      </div>
    </div>
  );
};

export const MarketVisibilityCard = () => (
  <Card className="p-5 bg-gradient-card border-border/50 space-y-3 relative overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-gold opacity-40" />
    <div className="flex items-center gap-2">
      <Eye className="h-5 w-5 text-primary" />
      <h3 className="font-display font-bold">Exibição do Mercado</h3>
    </div>
    <p className="text-xs text-muted-foreground -mt-1">
      Controle global de quais abas do Mercado ficam visíveis para todos os usuários.
    </p>
    <VisibilityToggle
      settingKey="market_show_free_agents"
      title="Aba de Passes Livres"
      description="Quando oculta, ninguém vê a aba de jogadores sem clube."
      icon={ShieldUser}
    />
    <VisibilityToggle
      settingKey="market_show_foreign_market"
      title="Aba de Mercado Estrangeiro"
      description="Quando oculta, ninguém vê a aba de jogadores de clubes estrangeiros."
      icon={Globe2}
    />
  </Card>
);
