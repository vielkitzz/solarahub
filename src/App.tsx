import { lazy, Suspense } from "react";
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

const Ranking = lazy(() => import("./pages/Ranking"));
const ClubsList = lazy(() => import("./pages/ClubsList"));
const ClubDetail = lazy(() => import("./pages/ClubDetail"));
const Market = lazy(() => import("./pages/Market"));
const WikiGlobal = lazy(() => import("./pages/WikiGlobal"));
const MyClub = lazy(() => import("./pages/MyClub"));
const Admin = lazy(() => import("./pages/Admin"));
const Transferencias = lazy(() => import("./pages/Transferencias"));
const Mapa = lazy(() => import("./pages/Mapa"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const NotFound = lazy(() => import("./pages/NotFound"));

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
