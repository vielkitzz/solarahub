import { NavLink, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Trophy,
  Shield,
  Users,
  BookOpen,
  Settings,
  LogOut,
  LogIn,
  ArrowRightLeft,
  MapPin,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navegarItems = [
  { title: "Início", url: "/", icon: HomeIcon },
  { title: "Ranking", url: "/ranking", icon: Trophy },
  { title: "Mapa", url: "/mapa", icon: MapPin },
];

const competicaoItems = [
  { title: "Clubes", url: "/clubes", icon: Shield },
  { title: "Mercado", url: "/mercado", icon: Users },
];

const conhecimentoItems = [
  { title: "Wiki Global", url: "/wiki", icon: BookOpen },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { user, isAdmin, signInWithDiscord, signOut } = useAuth();
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-14 flex flex-col justify-center border-b border-sidebar-border px-4 group-data-[collapsible=icon]:px-0 overflow-hidden">
        <div className="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
          <div className="h-9 w-9 shrink-0 flex items-center justify-center">
            <img src="/logo-solara-hub.svg" alt="Logo Solara Hub" className="h-full w-full object-contain" />
          </div>
          {/* Escondemos via CSS com 'group-data-[collapsible=icon]:hidden' em vez de usar o estado '!collapsed' */}
          <div className="min-w-0 group-data-[collapsible=icon]:hidden transition-opacity">
            <div className="font-display font-bold text-base leading-none text-sidebar-foreground truncate">
              SOLARA HUB
            </div>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navegar</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navegarItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Competição</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {competicaoItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Conhecimento</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {conhecimentoItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {user && (
          <SidebarGroup>
            <SidebarGroupLabel>Minha Conta</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/meu-clube")}>
                    <NavLink to="/meu-clube">
                      <Shield className="h-4 w-4" />
                      {!collapsed && <span>Meu Clube</span>}
                    </NavLink>
                  </SidebarMenuButton>
              </SidebarMenuItem>
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive("/admin")}>
                      <NavLink to="/admin">
                        <Settings className="h-4 w-4" />
                        {!collapsed && <span>Admin</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {user ? (
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8 shrink-0 ring-2 ring-primary/30">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback className="bg-secondary text-xs">{user.user_metadata?.name?.[0] ?? "U"}</AvatarFallback>
            </Avatar>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate text-sidebar-foreground">
                    {user.user_metadata?.full_name || user.user_metadata?.name || "Treinador"}
                  </div>
                  {isAdmin && <div className="text-[10px] gold-text font-bold">ADMIN</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8 shrink-0">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        ) : (
          <Button
            onClick={signInWithDiscord}
            variant="default"
            className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white"
          >
            <LogIn className="h-4 w-4" />
            {!collapsed && <span>Entrar com Discord</span>}
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
