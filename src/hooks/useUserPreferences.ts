import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  show_numeric_skill: boolean;
  show_numeric_potential: boolean;
}

const DEFAULT: UserPreferences = {
  show_numeric_skill: false,
  show_numeric_potential: false,
};

export const useUserPreferences = () => {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<UserPreferences>(DEFAULT);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setPrefs(DEFAULT);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_preferences")
      .select("show_numeric_skill, show_numeric_potential")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) setPrefs({ show_numeric_skill: !!data.show_numeric_skill, show_numeric_potential: !!data.show_numeric_potential });
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = async (next: Partial<UserPreferences>) => {
    if (!user) return;
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    await supabase
      .from("user_preferences")
      .upsert({ user_id: user.id, ...merged }, { onConflict: "user_id" });
  };

  return { prefs, loading, update, reload: load };
};
