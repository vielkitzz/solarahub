import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationsBell } from "./NotificationsBell";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-3 border-b border-border/50 bg-background/80 backdrop-blur-md px-4 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="flex-1" />
            <NotificationsBell />
          </header>
          <main className="flex-1 p-3 sm:p-4 md:p-8 animate-fade-in min-w-0">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
