import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const TransferWindowCard = () => {
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from("settings")
      .select("value")
      .eq("key", "transfer_window")
      .maybeSingle()
      .then(({ data }) => {
        const v: any = data?.value;
        setOpen(v?.open !== false);
        setLoading(false);
      });
  }, []);

  const toggle = async (next: boolean) => {
    setSaving(true);
    const { error } = await supabase
      .from("settings")
      .upsert({ key: "transfer_window", value: { open: next } as any }, { onConflict: "key" });
    setSaving(false);
    if (error) return toast.error(error.message);
    setOpen(next);
    toast.success(next ? "Janela de transferências aberta" : "Janela de transferências fechada");
  };

  return (
    <Card className="p-5 bg-gradient-card border-border/50 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <CalendarClock className="h-5 w-5 text-primary" />
        <div>
          <div className="font-display font-bold">Janela de transferências</div>
          <div className="text-xs text-muted-foreground">
            Quando fechada, nenhum clube pode criar propostas (admins ainda podem).
          </div>
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
