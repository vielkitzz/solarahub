import { useEffect } from "react";
import { Navigate } from "react-router-dom";

// /transferencias agora vive dentro de /mercado
const Transferencias = () => {
  useEffect(() => { document.title = "Mercado — Solara Hub"; }, []);
  return <Navigate to="/mercado" replace />;
};

export default Transferencias;
