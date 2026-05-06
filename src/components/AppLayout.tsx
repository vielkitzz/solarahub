import { ReactNode, useEffect, useState } from "react";
import { Inbox } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationsBell } from "./NotificationsBell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

function useInboxCount() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const fetchCount = async () => {
      // Busca os clubes do usuário logado
      const { data: clubs } = await supabase.from("clubs").select("id").eq("owner_id", user.id);

      if (!clubs || clubs.length === 0) {
        setCount(0);
        return;
      }

      const clubIds = clubs.map((c) => c.id);

      // Propostas pendentes onde o usuário precisa responder:
      // - normais (sem proposta_pai_id): usuário é vendedor
      // - contrapropostas (com proposta_pai_id): usuário é comprador
      const { data: proposals } = await supabase
        .from("transferencias")
        .select("id, clube_vendedor_id, clube_comprador_id, proposta_pai_id, status")
        .in("status", ["pendente", "contraproposta"]);

      if (!proposals) {
        setCount(0);
        return;
      }

      const pending = proposals.filter((p) => {
        const isCounter = !!p.proposta_pai_id;
        if (isCounter) {
          return clubIds.includes(p.clube_comprador_id) && p.status === "pendente";
        }
        return clubIds.includes(p.clube_vendedor_id) && p.status === "pendente";
      });

      setCount(pending.length);
    };

    fetchCount();

    // Atualiza em tempo real via realtime
    const channel = supabase
      .channel("inbox-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "transferencias" }, () => fetchCount())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}

export function AppLayout({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const inboxCount = useInboxCount();

  const goToInbox = () => {
    navigate("/mercado?tab=inbox");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Caixa de entrada do mercado"
                    onClick={goToInbox}
                    className="relative"
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
            </TooltipProvider>
            <NotificationsBell />
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-8 animate-fade-in min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
