import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SeasonContextType {
  currentSeason: string | null;
  loading: boolean;
  updateSeason: (season: string) => Promise<void>;
}

const SeasonContext = createContext<SeasonContextType | undefined>(undefined);

export const SeasonProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSeason, setCurrentSeason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSeason();
  }, []);

  const loadSeason = async () => {
    try {
      const { data, error } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "current_season")
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        const value = data.value;
        // Se value for uma string JSON, fazer parse; senão usar direto
        const season = typeof value === "string" ? JSON.parse(value) : value;
        setCurrentSeason(season);
      } else {
        setCurrentSeason("Temporada 2020");
      }
    } catch (err) {
      console.error("Erro ao carregar temporada:", err);
      setCurrentSeason("Temporada 2020");
    } finally {
      setLoading(false);
    }
  };

  const updateSeason = async (season: string) => {
    try {
      const { error } = await supabase
        .from("settings")
        .upsert({ key: "current_season", value: JSON.stringify(season) }, { onConflict: "key" });

      if (error) throw error;
      setCurrentSeason(season);
    } catch (err) {
      console.error("Erro ao atualizar temporada:", err);
      throw err;
    }
  };

  return (
    <SeasonContext.Provider value={{ currentSeason, loading, updateSeason }}>
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => {
  const context = useContext(SeasonContext);
  if (!context) {
    throw new Error("useSeason deve ser usado dentro de SeasonProvider");
  }
  return context;
};
