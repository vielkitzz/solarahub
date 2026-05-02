import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, Shield } from "lucide-react";

interface Club {
  id: string;
  name: string;
  city: string | null;
  crest_url: string | null;
  latitude: number;
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
    className: "hover:scale-110 transition-transform duration-200",
  });

const Mapa = () => {
  const [clubs, setClubs] = useState<Club[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    document.title = "Mapa de Clubes — Solara Hub";
    const fetchClubs = async () => {
      const { data } = await supabase
        .from("clubs")
        .select("id,name,city,crest_url,latitude,longitude")
        .eq("status", "ativo")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .order("name");

      setClubs((data as Club[]) || []);
      setLoading(false);
    };
    fetchClubs();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <style>{`
        /* Removemos todos os filtros de cor para preservar o estilo do MapTiler */
        .leaflet-container {
          background: #eef2ff !important; /* Fundo suave enquanto o mapa carrega */
          font-family: inherit !important;
        }

        /* Popups modernos e limpos para mapas claros */
        .leaflet-popup-content-wrapper {
          background: #ffffff !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1) !important;
          color: #1e293b !important;
          padding: 0 !important;
        }
        .leaflet-popup-content { margin: 0 !important; padding: 12px !important; }
        .leaflet-popup-tip { background: white !important; }

        /* Controles de zoom discretos */
        .leaflet-control-zoom a {
          background: white !important;
          color: #64748b !important;
          border: 1px solid #e2e8f0 !important;
        }
      `}</style>

      <header className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
          <MapPin className="h-8 w-8 text-primary" /> Mapa de Clubes
        </h1>
        <p className="text-muted-foreground">
          Localização dos clubes ativos no Solara Hub.
          {clubs.length > 0 && (
            <span className="ml-2 text-primary font-medium">{clubs.length} clubes encontrados.</span>
          )}
        </p>
      </header>

      {loading ? (
        <Skeleton className="h-[65vh] min-h-[500px] w-full rounded-xl" />
      ) : (
        <Card className="overflow-hidden border-border/50 p-0 relative z-0">
          <MapContainer
            center={[-15.78, -47.92]} // Centralizado no Brasil
            zoom={4}
            scrollWheelZoom
            className="h-[65vh] min-h-[500px] w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a>'
              url="https://api.maptiler.com/maps/019de970-289e-7f79-bb68-c4b9157a1883/{z}/{x}/{y}.png?key=wkMSZlh7Ayi2MJyMxrJ4"
            />

            {clubs.map((c) => (
              <Marker key={c.id} position={[c.latitude, c.longitude]} icon={createClubIcon(c.crest_url)}>
                <Popup>
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-16 w-16 bg-slate-50 rounded-lg p-2 flex items-center justify-center border border-slate-100">
                      {c.crest_url ? (
                        <img src={c.crest_url} alt={c.name} className="h-full w-full object-contain" />
                      ) : (
                        <Shield className="h-10 w-10 text-slate-300" />
                      )}
                    </div>
                    <div className="text-center">
                      <div className="font-bold text-slate-900">{c.name}</div>
                      {c.city && (
                        <div className="text-xs text-slate-500 flex items-center justify-center gap-1">
                          <MapPin size={10} /> {c.city}
                        </div>
                      )}
                    </div>
                    <button
                      className="w-full py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:brightness-110 transition-all"
                      onClick={() => navigate(`/clubes/${c.id}`)}
                    >
                      ACESSAR CLUBE
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </Card>
      )}
    </div>
  );
};

export default Mapa;
