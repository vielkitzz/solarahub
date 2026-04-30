import { useEffect, useState } from "react";
import { Bell, Check, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Notif = {
  id: string;
  tipo: string;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
};

export const NotificationsBell = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[]>([]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, tipo, titulo, mensagem, lida, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    setItems((data as any) || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("notif-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const naoLidas = items.filter(n => !n.lida).length;

  const marcarTodas = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ lida: true }).eq("user_id", user.id).eq("lida", false);
    load();
  };

  const remover = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    load();
  };

  if (!user) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {naoLidas > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 bg-primary text-primary-foreground text-[10px]">
              {naoLidas}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between p-3 border-b border-border/50">
          <div className="font-display font-bold text-sm">Notificações</div>
          {naoLidas > 0 && (
            <Button size="sm" variant="ghost" onClick={marcarTodas} className="h-7 text-xs">
              <Check className="h-3 w-3" /> Marcar como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-[400px]">
          {items.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Sem notificações.</div>
          ) : (
            <ul className="divide-y divide-border/50">
              {items.map((n) => (
                <li key={n.id} className={`p-3 ${!n.lida ? "bg-primary/5" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-display font-bold text-sm truncate">{n.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{n.mensagem}</div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.created_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => remover(n.id)} className="h-6 w-6 shrink-0">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};
