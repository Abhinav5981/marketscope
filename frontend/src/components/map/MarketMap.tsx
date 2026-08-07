import { CircleMarker, MapContainer, Popup, Rectangle, TileLayer } from "react-leaflet";
import type { DiscoveredStore, Market, PortfolioStore } from "../../types";

export interface LayerVisibility {
  discovered: boolean;
  portfolioInside: boolean;
  portfolioOutside: boolean;
}

interface MarketMapProps {
  market: Market;
  discoveredStores: DiscoveredStore[];
  portfolioInside: PortfolioStore[];
  portfolioOutside: PortfolioStore[];
  visibility: LayerVisibility;
}

const COLORS = {
  discovered: "#2563eb",
  inside: "#15803d",
  outside: "#b45309",
};

export function MarketMap({ market, discoveredStores, portfolioInside, portfolioOutside, visibility }: MarketMapProps) {
  const bounds: [[number, number], [number, number]] = [
    [market.minLat, market.minLng],
    [market.maxLat, market.maxLng],
  ];
  const center: [number, number] = [(market.minLat + market.maxLat) / 2, (market.minLng + market.maxLng) / 2];

  return (
    <div className="map-container">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Rectangle bounds={bounds} pathOptions={{ color: "#64748b", weight: 1, fillOpacity: 0, dashArray: "4 4" }} />

        {visibility.discovered &&
          discoveredStores.map((store) => (
            <CircleMarker
              key={store.id}
              center={[store.latitude, store.longitude]}
              radius={6}
              pathOptions={{ color: COLORS.discovered, fillColor: COLORS.discovered, fillOpacity: 0.85 }}
            >
              <Popup>
                <strong>{store.name}</strong>
                <br />
                {store.category.name}
                <br />
                <span style={{ color: "#64748b" }}>Discovered · {store.osmTag}</span>
              </Popup>
            </CircleMarker>
          ))}

        {visibility.portfolioInside &&
          portfolioInside
            .filter((s) => s.latitude !== null && s.longitude !== null)
            .map((store) => (
              <CircleMarker
                key={store.id}
                center={[store.latitude as number, store.longitude as number]}
                radius={6}
                pathOptions={{ color: COLORS.inside, fillColor: COLORS.inside, fillOpacity: 0.85 }}
              >
                <Popup>
                  <strong>{store.storeName}</strong>
                  <br />
                  {store.category ?? "Unknown"}
                  <br />
                  <span style={{ color: "#64748b" }}>Portfolio · inside boundary</span>
                </Popup>
              </CircleMarker>
            ))}

        {visibility.portfolioOutside &&
          portfolioOutside
            .filter((s) => s.latitude !== null && s.longitude !== null)
            .map((store) => (
              <CircleMarker
                key={store.id}
                center={[store.latitude as number, store.longitude as number]}
                radius={6}
                pathOptions={{ color: COLORS.outside, fillColor: COLORS.outside, fillOpacity: 0.85 }}
              >
                <Popup>
                  <strong>{store.storeName}</strong>
                  <br />
                  {store.category ?? "Unknown"}
                  <br />
                  <span style={{ color: "#64748b" }}>Portfolio · outside boundary</span>
                </Popup>
              </CircleMarker>
            ))}
      </MapContainer>
    </div>
  );
}
