import { ReactNode, useCallback, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationsBell } from "./NotificationsBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Conta propostas que aguardam ação do usuário logado, somando todos os clubes dele:
 *  - Internas: como vendedor (proposta inicial pendente), como comprador/vendedor
 *    em contraproposta pendente vinda do outro lado, ou aguardando confirmação.
 *  - Externas: propostas pendentes de clubes estrangeiros pelos jogadores do clube.
 *
 * Usa COUNT server-side e atualiza via Realtime nas tabelas relevantes.
 */
function useInboxCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setCount(0);
      return;
    }

    const { data: clubs } = await supabase.from("clubs").select("id").eq("owner_id", user.id);
    const clubIds = (clubs || []).map((c) => c.id);
    if (clubIds.length === 0) {
      setCount(0);
      return;
    }

    const sellerQ = supabase
      .from("transferencias")
      .select("id", { count: "exact", head: true })
      .in("clube_vendedor_id", clubIds)
      .eq("status", "pendente")
      .is("proposta_pai_id", null);

    const counterQ = supabase
      .from("transferencias")
      .select("id, created_by, clube_vendedor_id, clube_comprador_id")
      .or(
        `clube_vendedor_id.in.(${clubIds.join(",")}),clube_comprador_id.in.(${clubIds.join(",")})`,
      )
      .eq("status", "pendente")
      .not("proposta_pai_id", "is", null);

    const confirmQ = supabase
      .from("transferencias")
      .select("id", { count: "exact", head: true })
      .in("clube_comprador_id", clubIds)
      .eq("status", "aguardando_confirmacao");

    const playersQ = supabase.from("players").select("id").in("club_id", clubIds);

    const [sellerRes, counterRes, confirmRes, playersRes] = await Promise.all([
      sellerQ,
      counterQ,
      confirmQ,
      playersQ,
    ]);

    const sellerCount = sellerRes.count || 0;
    const confirmCount = confirmRes.count || 0;
    const counterCount = (counterRes.data || []).filter(
      (p: any) => p.created_by !== user.id,
    ).length;

    let externalCount = 0;
    const playerIds = (playersRes.data || []).map((p) => p.id);
    if (playerIds.length > 0) {
      const { count: c } = await supabase
        .from("external_proposals")
        .select("id", { count: "exact", head: true })
        .in("player_id", playerIds)
        .eq("status", "pendente");
      externalCount = c || 0;
    }

    setCount(sellerCount + counterCount + confirmCount + externalCount);
  }, [user]);

  useEffect(() => {
    fetchCount();
    if (!user) return;

    const channel = supabase
      .channel("inbox-count-" + user.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transferencias" },
        fetchCount,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "external_proposals" },
        fetchCount,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchCount]);

  return count;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const inboxCount = useInboxCount();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="h-14 flex items-center gap-1 sm:gap-3 border-b border-border/50 bg-background/80 backdrop-blur-md px-2 sm:px-4 sticky top-0 z-30"
            style={{ paddingTop: "env(safe-area-inset-top)" }}
          >
            <SidebarTrigger />
            <div className="flex-1" />
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Caixa de entrada do mercado"
                  onClick={() => navigate("/mercado?tab=inbox")}
                  className="relative h-10 w-10"
                >
                  <Inbox className="h-5 w-5" />
                  {inboxCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] leading-none flex items-center justify-center bg-primary text-primary-foreground rounded-full pointer-events-none">
                      {inboxCount > 99 ? "99+" : inboxCount}
                    </Badge>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                Caixa de entrada do mercado
                {inboxCount > 0 && ` · ${inboxCount} pendente${inboxCount > 1 ? "s" : ""}`}
              </TooltipContent>
            </Tooltip>
            <NotificationsBell />
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-8 animate-fade-in min-w-0 pb-[env(safe-area-inset-bottom)]">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
