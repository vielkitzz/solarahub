import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Shield } from "lucide-react";

// Interface aprimorada
interface Club {
  id: string;
  name: string;
  city: string | null;
  crest_url: string | null;
  latitude: number; // Mudado para number para facilitar o map
  longitude: number;
}

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
    className: "custom-club-icon", // Classe para CSS externo
  });

const Mapa = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;
    document.title = "Mapa de Clubes — Solara Hub";

    const fetchClubs = async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, city, crest_url, latitude, longitude")
        .eq("status", "ativo")
        .not("latitude", "is", null) // Filtro direto no banco para performance
        .not("longitude", "is", null)
        .order("name");

      if (error) {
        console.error("Erro ao buscar clubes:", error);
      } else if (isMounted) {
        setClubs((data as unknown as Club[]) || []);
      }

      if (isMounted) setLoading(false);
    };

    fetchClubs();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto p-4">
      <style>{`
        .custom-club-icon {
          background: transparent;
          border: none;
          object-fit: contain;
          transition: transform 0.2s;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.5));
        }
        .custom-club-icon:hover { transform: scale(1.2); }

        /* Filtro para transformar mapa claro em tons de Azul Suave */
        .map-tile-layer {
          filter: 
            brightness(1.05)    /* Mantém o mapa bem claro */
            contrast(1.05)      /* Melhora a definição das ruas */
            sepia(1)            /* Unifica as cores para uma base quente */
            hue-rotate(185deg)  /* Gira o sepia exatamente para o Azul Solara */
            saturate(0.6);      /* Deixa o azul elegante, não muito "neon" */
        }
        
        /* O fundo do container deve ser o azul da água desejado */
        .leaflet-container {
          background: #e0f2fe !important; /* Um azul bem clarinho para o fundo do mar */
        }
        
        /* Garanta que o ícone do clube não seja afetado pelo filtro do mapa */
        .leaflet-marker-pane {
          filter: none !important;
        }

        /* Melhoria nos Popups para evitar conflitos de estilo */
        .leaflet-popup-content-wrapper {
          background: #0f172a !important;
          color: white !important;
          border: 1px solid #1e293b !important;
          border-radius: 12px !important;
        }
        
        .access-button {
          transition: all 0.2s ease;
        }
        .access-button:hover {
          filter: brightness(1.1);
          transform: translateY(-1px);
        }
      `}</style>

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <MapPin className="h-8 w-8 text-yellow-500" /> Mapa de Clubes
          </h1>
          <p className="text-muted-foreground mt-1">Localização geográfica das unidades ativas do Solara Hub.</p>
        </div>
        {clubs.length > 0 && (
          <div className="bg-secondary/50 px-4 py-2 rounded-full text-sm font-semibold border border-border">
            {clubs.length} Clubes Detectados
          </div>
        )}
      </header>

      {loading ? (
        <Skeleton className="h-[65vh] w-full rounded-xl" />
      ) : (
        <Card className="relative overflow-hidden border-border/40 shadow-2xl">
          <MapContainer
            center={[-15.78, -47.92]} // Centralizado em Brasília
            zoom={4}
            minZoom={3}
            scrollWheelZoom={true}
            className="h-[65vh] w-full"
          >
            <TileLayer
              className="map-tile-layer"
              attribution="&copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
            />

            {clubs.map((club) => (
              <Marker key={club.id} position={[club.latitude, club.longitude]} icon={createClubIcon(club.crest_url)}>
                <Popup closeButton={false}>
                  <div className="flex flex-col items-center p-2 min-w-[160px]">
                    <div className="w-16 h-16 mb-2 flex items-center justify-center bg-white/5 rounded-lg p-2">
                      {club.crest_url ? (
                        <img src={club.crest_url} alt={club.name} className="max-h-full max-w-full object-contain" />
                      ) : (
                        <Shield className="h-10 w-10 text-yellow-500/50" />
                      )}
                    </div>

                    <span className="font-bold text-center text-sm leading-tight mb-1">{club.name}</span>

                    {club.city && (
                      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-3 uppercase tracking-wider">
                        <MapPin size={10} /> {club.city}
                      </div>
                    )}

                    <button
                      className="access-button w-full py-2 bg-yellow-500 text-black text-[11px] font-bold rounded-md"
                      onClick={() => navigate(`/clubes/${club.id}`)}
                    >
                      VISITAR PERFIL
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Card>
      )}

      {!loading && clubs.length === 0 && (
        <div className="p-12 text-center border-2 border-dashed border-border rounded-xl">
          <p className="text-muted-foreground">Nenhum clube com coordenadas geográficas encontrado.</p>
        </div>
      )}
    </div>
  );
};

export default Mapa;
