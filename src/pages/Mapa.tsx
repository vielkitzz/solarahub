import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Shield } from "lucide-react";

// --- Definição da Interface ---
interface Club {
  id: string;
  name: string;
  city: string | null;
  crest_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

// --- Constantes e Funções Auxiliares ---
const PLACEHOLDER_CREST =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23facc15' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>`,
  );

const createClubIcon = (crestUrl: string | null) =>
  new L.Icon({
    iconUrl: crestUrl || PLACEHOLDER_CREST,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
    className: "bg-transparent border-none shadow-none object-contain hover:scale-110 transition-transform",
  });

// --- Componente Principal ---
const Mapa = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Mapa de Clubes — Solara Hub";
    (async () => {
      const { data } = await supabase
        .from("clubs")
        .select("id,name,city,crest_url,latitude,longitude")
        .eq("status", "ativo")
        .order("name");
      setClubs((data as Club[]) || []);
      setLoading(false);
    })();
  }, []);

  const geoClubs = clubs.filter((c) => c.latitude !== null && c.longitude !== null);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/*
        Estratégia "Água vs Terra":
        
        1. Água (Fundo): Definida via CSS no .leaflet-container.
           - Cor sólida azul marinho escuro (#0a1929).
           - Não recebe filtro, então fica com a cor pura e escura desejada.
           
        2. Terra (Tiles): Recebe filtro CSS agressivo.
           - invert(1): Transforma o preto/cinza escuro do tile em branco/cinza claro.
           - brightness(55%): Escurece esse branco para um cinza médio.
           - hue-rotate(180deg): Desloca esse cinza para o azul.
           - Resultado: Uma cor azul clara/desbotada que contrasta com o fundo marinho.
      */}
      <style>{`
        /* Filtro aplicado APENAS nas imagens do mapa (terra/ruas) */
        .map-tile-layer {
          filter: 
            hue-rotate(215deg) /* Mudança de 195 para 215 para um azul mais "navy" */
            saturate(180%)     /* Reduzi levemente a saturação para ficar mais sóbrio */
            brightness(85%)    /* Escureci um pouco para combinar com o fundo */
            contrast(110%);
        }

        /* O container define a cor da ÁGUA */
        .leaflet-container {
          /* Tente este hex para um Navy Blue mais clássico/escuro */
          background: #001f3f !important; 
          font-family: inherit !important;
        }

        /* Estética do Popup */
        .leaflet-popup-content-wrapper {
          background: hsl(207 53% 16%) !important;
          border: 1px solid hsl(207 45% 32%) !important;
          border-radius: 0.875rem !important;
          box-shadow: 0 10px 40px -10px hsl(207 80% 2% / 0.7) !important;
          color: hsl(0 0% 98%) !important;
          padding: 0 !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          padding: 12px 14px !important;
          width: auto !important;
          min-width: 180px !important;
        }
        .leaflet-popup-tip-container { display: none !important; }
        .leaflet-marker-icon:focus { outline: none !important; }
        
        /* Atribuição e Controles */
        .leaflet-control-attribution {
          background: hsl(207 67% 8% / 0.9) !important;
          color: hsl(207 20% 55%) !important;
          border-radius: 6px 0 0 0 !important;
          font-size: 9px !important;
        }
        .leaflet-control-attribution a { color: hsl(44 100% 52%) !important; }
        
        .leaflet-control-zoom a {
          background: hsl(207 53% 18%) !important;
          color: hsl(0 0% 92%) !important;
          border: 1px solid hsl(207 45% 32%) !important;
        }
        .leaflet-control-zoom a:hover {
          background: hsl(207 49% 25%) !important;
          color: hsl(44 100% 52%) !important;
        }
      `}</style>

      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" /> Mapa de Clubes
        </h1>
        <p className="text-muted-foreground">
          Localização geográfica dos clubes ativos.{" "}
          {geoClubs.length > 0 && <span className="text-primary font-medium">{geoClubs.length} clube(s) no mapa.</span>}
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-[65vh] min-h-[500px] w-full rounded-[var(--radius)]" />
      ) : (
        <Card className="overflow-hidden bg-gradient-card border-border/50 p-0 relative z-0">
          <MapContainer
            center={[-15.0, -55.0]}
            zoom={4}
            scrollWheelZoom
            className="h-[65vh] min-h-[500px] w-full z-0"
            /* Certifique-se de que este estilo inline corresponde ao CSS acima */
            style={{ background: "#001f3f" }}
          >
            <TileLayer
              className="map-tile-layer"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              // 👇 MUDE ESTA LINHA AQUI 👇
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {geoClubs.map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude as number, c.longitude as number]}
                icon={createClubIcon(c.crest_url)}
              >
                <Popup>
                  <div className="flex flex-col items-center gap-2 py-1">
                    <div className="h-12 w-12 flex items-center justify-center">
                      {c.crest_url ? (
                        <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain drop-shadow-md" />
                      ) : (
                        <Shield className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        textAlign: "center",
                        color: "hsl(0 0% 98%)",
                        lineHeight: 1.3,
                        margin: 0,
                      }}
                    >
                      {c.name}
                    </div>
                    {c.city && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          fontSize: 11,
                          color: "hsl(207 20% 65%)",
                          margin: 0,
                        }}
                      >
                        <MapPin size={11} />
                        {c.city}
                      </div>
                    )}
                    <button
                      style={{
                        width: "100%",
                        marginTop: 6,
                        padding: "6px 12px",
                        background: "linear-gradient(135deg, hsl(44 100% 52%), hsl(38 100% 48%))",
                        color: "hsl(207 80% 6%)",
                        fontWeight: 700,
                        fontSize: 12,
                        borderRadius: 8,
                        border: "none",
                        cursor: "pointer",
                      }}
                      onClick={() => navigate(`/clubes/${c.id}`)}
                    >
                      Acessar Clube
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Card>
      )}

      {!loading && geoClubs.length === 0 && (
        <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
          Nenhum clube com coordenadas cadastradas ainda. Adicione latitude e longitude nos clubes pelo painel Admin.
        </Card>
      )}
    </div>
  );
};

export default Mapa;
