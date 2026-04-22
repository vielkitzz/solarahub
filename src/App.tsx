import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import Home from "./pages/Home";
import Ranking from "./pages/Ranking";
import ClubsList from "./pages/ClubsList";
import ClubDetail from "./pages/ClubDetail";
import Market from "./pages/Market";
import WikiGlobal from "./pages/WikiGlobal";
import MyClub from "./pages/MyClub";
import Admin from "./pages/Admin";
import Transferencias from "./pages/Transferencias";
import Mapa from "./pages/Mapa";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner theme="dark" />
      <BrowserRouter>
        <AuthProvider>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/clubes" element={<ClubsList />} />
              <Route path="/clubes/:id" element={<ClubDetail />} />
              <Route path="/mapa" element={<Mapa />} />
              <Route path="/mercado" element={<Market />} />
              <Route path="/wiki" element={<WikiGlobal />} />
              <Route path="/meu-clube" element={<MyClub />} />
              <Route path="/transferencias" element={<Transferencias />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
