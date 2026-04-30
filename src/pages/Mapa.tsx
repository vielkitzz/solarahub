import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Shield } from "lucide-react";

interface Club {
  id: string;
  name: string;
  city: string | null;
  crest_url: string | null;
  latitude: number | null;
  longitude: number | null;
}

const PLACEHOLDER_CREST =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23facc15' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z'/></svg>`,
  );

// 1. MOLDURA REMOVIDA: Limpamos o className para deixar apenas o escudo com fundo transparente
const createClubIcon = (crestUrl: string | null) =>
  new L.Icon({
    iconUrl: crestUrl || PLACEHOLDER_CREST,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
    className: "bg-transparent border-none shadow-none object-contain hover:scale-110 transition-transform",
  });

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
      {/* 2. MAPA AZUL: Este estilo converte o mapa preto/cinza para o azul escuro do app */}
      <style>{`
        .blue-theme-map {
          filter: sepia(100%) hue-rotate(185deg) saturate(350%) brightness(65%) contrast(110%);
        }
      `}</style>

      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" /> Mapa de Clubes
        </h1>
        <p className="text-muted-foreground">
          Localização geográfica dos clubes ativos. {geoClubs.length} clube(s) no mapa.
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-[65vh] min-h-[500px] w-full rounded-[var(--radius)]" />
      ) : (
        <Card className="overflow-hidden bg-gradient-card border-border/50 p-0 relative z-0">
          <MapContainer
            center={[-35.0, -65.0]}
            zoom={4}
            scrollWheelZoom
            className="h-[65vh] min-h-[500px] w-full z-0 bg-[#0a1128]" // Fundo azul escuro enquanto carrega
          >
            <TileLayer
              className="blue-theme-map" // <-- Aplica o filtro de cor criado lá em cima
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
            {geoClubs.map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude as number, c.longitude as number]}
                icon={createClubIcon(c.crest_url)}
              >
                <Popup>
                  <div className="flex flex-col items-center gap-2 min-w-[180px] py-1">
                    <div className="h-12 w-12 flex items-center justify-center">
                      {c.crest_url ? (
                        <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain drop-shadow-md" />
                      ) : (
                        <Shield className="h-8 w-8 text-muted-foreground" />
                      )}
                    </div>
                    <div className="font-bold text-center text-foreground !m-0 leading-tight">{c.name}</div>
                    {c.city && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground !m-0">
                        <MapPin className="h-3 w-3" /> {c.city}
                      </div>
                    )}
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-gradient-gold text-primary-foreground hover:opacity-90"
                      onClick={() => navigate(`/clubes/${c.id}`)}
                    >
                      Acessar Clube
                    </Button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Card>
      )}

      {!loading && geoClubs.length === 0 && (
        <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
          Nenhum clube com coordenadas cadastradas ainda.
        </Card>
      )}
    </div>
  );
};

export default Mapa;
