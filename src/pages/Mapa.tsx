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

// ... (Interfaces e consts permanecem iguais) ...

const Mapa = () => {
  // ... (Estados e Effects permanecem iguais) ...

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
           - brightness(60%): Escurece esse branco para um cinza médio.
           - hue-rotate(...): Desloca esse cinza para o azul.
           - Resultado: Uma cor azul clara/desbotada que contrasta com o fundo marinho.
      */}
      <style>{`
        /* Filtro aplicado APENAS nas imagens do mapa (terra/ruas) */
        .map-tile-layer {
          filter:
            invert(1) 
            brightness(55%)
            hue-rotate(180deg)
            saturate(150%);
        }

        /* O container define a cor da ÁGUA */
        .leaflet-container {
          background: #0a1929 !important; /* Azul marinho profundo */
          font-family: inherit !important;
        }

        /* Estética do Popup (mantendo o padrão) */
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
            // Importante: O style background aqui deve ser idêntico ao do .leaflet-container no CSS
            style={{ background: "#0a1929" }}
          >
            <TileLayer
              className="map-tile-layer"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />

            {geoClubs.map((c) => (
              <Marker
                key={c.id}
                position={[c.latitude as number, c.longitude as number]}
                icon={createClubIcon(c.crest_url)}
              >
                {/* Popup continua igual */}
                <Popup>
                  {/* ... conteúdo do popup ... */}
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

      {/* Card de "sem clubes" permanece igual */}
      {!loading && geoClubs.length === 0 && (
        <Card className="p-8 text-center bg-gradient-card border-border/50 text-muted-foreground">
          Nenhum clube com coordenadas cadastradas ainda. Adicione latitude e longitude nos clubes pelo painel Admin.
        </Card>
      )}
    </div>
  );
};

export default Mapa;
