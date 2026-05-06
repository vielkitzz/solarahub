import { createClient } from "@supabase/supabase-js";

// Cria um sistema de armazenamento robusto para evitar falhas no celular
const customStorage = {
  getItem: (key: string) => {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn("Falha ao ler storage no celular");
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn("Navegador bloqueou a gravação da sessão");
    }
  },
  removeItem: (key: string) => {
    try {
      window.localStorage.removeItem(key);
    } catch (e) {}
  },
};

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true, // Força o Supabase a manter o usuário logado
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: customStorage,
    storageKey: "solarahub-auth-token", // Nome único para a sessão do jogo
  },
});
