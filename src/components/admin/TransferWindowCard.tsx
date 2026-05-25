import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarClock, Globe2, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WindowConfig {
  settingKey: string;
  title: string;
  description: string;
  icon?: React.ElementType;
}

const WindowToggle = ({ settingKey, title, description, icon: Icon = CalendarClock }: WindowConfig) => {
  const [open, setOpen] = useState(true);
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
        setOpen(v?.open !== false);
        setLoading(false);
      });
  }, [settingKey]);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: settingKey, value: { open: next } as any }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(next);
    toast.success(next ? `${title} aberta` : `${title} fechada`);
  };

  return (
    <Card className="p-5 bg-gradient-card border-border/50 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <Icon className="h-5 w-5 text-primary" />
        <div>
          <div className="font-display font-bold">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {(loading || saving) && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        <Label className="text-xs">{open ? "Aberta" : "Fechada"}</Label>
        <Switch checked={open} onCheckedChange={toggle} disabled={loading || saving} />
      </div>
    </Card>
  );
};

export const TransferWindowCard = () => (
  <div className="space-y-3">
    <WindowToggle
      settingKey="transfer_window"
      title="Janela de transferências"
      description="Quando fechada, nenhum clube pode criar propostas (admins ainda podem)."
    />
    <WindowToggle
      settingKey="foreign_market_window"
      title="Janela do mercado estrangeiro"
      description="Quando fechada, propostas para jogadores do exterior ficam bloqueadas."
      icon={Globe2}
    />
    <WindowToggle
      settingKey="free_agents_window"
      title="Janela de passes livres"
      description="Quando fechada, jogadores agentes livres não podem ser contratados."
      icon={UserCheck}
    />
  </div>
);
