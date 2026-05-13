import { lazy, Suspense, useEffect } from "react";

if (typeof window !== "undefined") {
  // limpa o flag assim que a app carrega com sucesso
  window.addEventListener("load", () => sessionStorage.removeItem("__chunk_reload__"));
}
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { SeasonProvider } from "@/contexts/SeasonContext";
import { UserPreferencesProvider } from "@/contexts/UserPreferencesContext";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth, RequireAdmin } from "@/components/auth/RouteGuards";

// Home fica eager (LCP), demais ficam lazy para reduzir o bundle inicial.
import Home from "./pages/Home";

// Wrapper que recupera de "Failed to fetch dynamically imported module"
// (chunk antigo após hot-update / novo deploy): tenta novamente, e se falhar
// força um reload para puxar o manifest atualizado.
function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  factory: () => Promise<T>,
) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/dynamically imported module|Importing a module script failed/i.test(msg)) {
        // tenta uma vez mais (cache pode estar quente)
        try {
          return await factory();
        } catch {
          // sinaliza reload único para evitar loop
          if (!sessionStorage.getItem("__chunk_reload__")) {
            sessionStorage.setItem("__chunk_reload__", "1");
            window.location.reload();
          }
        }
      }
      throw err;
    }
  });
}

const Ranking = lazyWithRetry(() => import("./pages/Ranking"));
const ClubsList = lazyWithRetry(() => import("./pages/ClubsList"));
const ClubDetail = lazyWithRetry(() => import("./pages/ClubDetail"));
const Market = lazyWithRetry(() => import("./pages/Market"));
const WikiGlobal = lazyWithRetry(() => import("./pages/WikiGlobal"));
const MyClub = lazyWithRetry(() => import("./pages/MyClub"));
const Admin = lazyWithRetry(() => import("./pages/Admin"));
const Transferencias = lazyWithRetry(() => import("./pages/Transferencias"));
const Mapa = lazyWithRetry(() => import("./pages/Mapa"));
const Configuracoes = lazyWithRetry(() => import("./pages/Configuracoes"));
const NotFound = lazyWithRetry(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex h-[60vh] w-full items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <SeasonProvider>
            <UserPreferencesProvider>
              <AppLayout>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    {/* Públicas */}
                    <Route path="/" element={<Home />} />
                    <Route path="/ranking" element={<Ranking />} />
                    <Route path="/clubes" element={<ClubsList />} />
                    <Route path="/clubes/:id" element={<ClubDetail />} />
                    <Route path="/mapa" element={<Mapa />} />
                    <Route path="/wiki" element={<WikiGlobal />} />
                    <Route path="/transferencias" element={<Transferencias />} />

                    {/* Exigem login */}
                    <Route
                      path="/mercado"
                      element={
                        <RequireAuth>
                          <Market />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/meu-clube"
                      element={
                        <RequireAuth>
                          <MyClub />
                        </RequireAuth>
                      }
                    />
                    <Route
                      path="/configuracoes"
                      element={
                        <RequireAuth>
                          <Configuracoes />
                        </RequireAuth>
                      }
                    />

                    {/* Admin only */}
                    <Route
                      path="/admin"
                      element={
                        <RequireAdmin>
                          <Admin />
                        </RequireAdmin>
                      }
                    />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </AppLayout>
            </UserPreferencesProvider>
          </SeasonProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
