import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Shirt, Loader2 } from "lucide-react";

export const ShirtNumberDialog = ({
  player,
  open,
  onOpenChange,
  onSaved,
}: {
  player: { id: string; name: string; shirt_number?: number | null; attributes?: any } | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) => {
  const [num, setNum] = useState<number>(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (player) {
      const initial = player.shirt_number ?? player.attributes?.shirtNumber ?? 0;
      setNum(Number(initial) || 0);
    }
  }, [player?.id]);

  const save = async () => {
    if (!player) return;
    if (num < 1 || num > 99) return toast.error("Número deve estar entre 1 e 99");
    setSaving(true);
    // Atualiza coluna nova + mantém em attributes para compat
    const { data: cur } = await supabase.from("players").select("attributes").eq("id", player.id).single();
    const newAttrs = { ...(cur?.attributes as any || {}), shirtNumber: num };
    const { error } = await supabase
      .from("players")
      .update({ shirt_number: num, attributes: newAttrs })
      .eq("id", player.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Camisa ${num} atribuída a ${player.name}`);
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shirt className="h-5 w-5 text-primary" /> Número da camisa
          </DialogTitle>
          <DialogDescription>{player?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Número (1-99)</Label>
          <NumberInput value={num} onChange={setNum} min={1} max={99} thousands={false} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
