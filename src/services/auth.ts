/**
 * Wrapper de auth — reexporta o contexto e expõe RequireAuth/RequireAdmin.
 */
export { useAuth, AuthProvider } from "@/contexts/AuthContext";
export { RequireAuth, RequireAdmin } from "@/components/auth/RouteGuards";
