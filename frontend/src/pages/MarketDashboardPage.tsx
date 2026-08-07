import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMarketDashboard, useMarketStatus } from "../api/hooks";
import { LayerToggle } from "../components/map/LayerToggle";
import { MarketMap, type LayerVisibility } from "../components/map/MarketMap";

type ListLayer = "discovered" | "portfolioInside" | "portfolioOutside" | "portfolioUngeocoded";

const LAYER_LABEL: Record<ListLayer, string> = {
  discovered: "Discovered",
  portfolioInside: "Portfolio (inside)",
  portfolioOutside: "Portfolio (outside)",
  portfolioUngeocoded: "Portfolio (unlocated)",
};

export function MarketDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const statusQuery = useMarketStatus(id);
  const status = statusQuery.data?.status;
  const inProgress = status === "PENDING" || status === "DISCOVERING";
  const dashboardQuery = useMarketDashboard(id, !inProgress);

  const [visibility, setVisibility] = useState<LayerVisibility>({
    discovered: true,
    portfolioInside: true,
    portfolioOutside: true,
  });

  if (!id) return null;

  if (statusQuery.isLoading) {
    return <p className="empty-state">Loading…</p>;
  }

  if (inProgress) {
    return (
      <div className="card">
        <h1 className="page-title">Creating market…</h1>
        <p className="page-subtitle">
          <span className="spinner" /> {status === "DISCOVERING" ? "Discovering stores in the boundary" : "Starting"}
          … this geocodes any missing portfolio coordinates and queries the places API, which can take up to a
          minute for a full-size boundary.
        </p>
      </div>
    );
  }

  const dashboard = dashboardQuery.data;
  if (dashboardQuery.isLoading || !dashboard) {
    return <p className="empty-state">Loading dashboard…</p>;
  }

  const combinedList: { id: string; name: string; category: string; layer: ListLayer }[] = [
    ...dashboard.discoveredStores.map((s) => ({ id: s.id, name: s.name, category: s.category.name, layer: "discovered" as const })),
    ...dashboard.portfolioInside.map((s) => ({ id: s.id, name: s.storeName, category: s.category ?? "Unknown", layer: "portfolioInside" as const })),
    ...dashboard.portfolioOutside.map((s) => ({ id: s.id, name: s.storeName, category: s.category ?? "Unknown", layer: "portfolioOutside" as const })),
    ...dashboard.portfolioUngeocoded.map((s) => ({ id: s.id, name: s.storeName, category: s.category ?? "Unknown", layer: "portfolioUngeocoded" as const })),
  ];

  const visibleList = combinedList.filter((item) =>
    item.layer === "portfolioUngeocoded" ? true : visibility[item.layer]
  );

  return (
    <div>
      <h1 className="page-title">{dashboard.market.name}</h1>
      <p className="page-subtitle">
        {dashboard.market.city.name} · {dashboard.market.areaSqKm.toFixed(1)} sq km · categories:{" "}
        {dashboard.market.categories.map((c) => c.category.name).join(", ")}
      </p>

      {dashboard.market.status === "FAILED" && (
        <div className="alert alert-danger">
          Market creation failed{dashboard.market.errorMessage ? `: ${dashboard.market.errorMessage}` : "."}
        </div>
      )}
      {dashboard.market.status === "READY" && dashboard.market.errorMessage && (
        <div className="alert alert-warning">{dashboard.market.errorMessage}</div>
      )}

      <div className="dashboard-layout">
        <MarketMap
          market={dashboard.market}
          discoveredStores={dashboard.discoveredStores}
          portfolioInside={dashboard.portfolioInside}
          portfolioOutside={dashboard.portfolioOutside}
          visibility={visibility}
        />

        <div>
          <div className="card">
            <h2>Layers</h2>
            <LayerToggle
              visibility={visibility}
              onChange={setVisibility}
              counts={{
                discovered: dashboard.discoveredStores.length,
                portfolioInside: dashboard.portfolioInside.length,
                portfolioOutside: dashboard.portfolioOutside.length,
                portfolioUngeocoded: dashboard.portfolioUngeocoded.length,
              }}
            />
          </div>

          <div className="card">
            <h2>Stores ({visibleList.length})</h2>
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              {visibleList.length === 0 && <p className="empty-state">No stores match the current layers.</p>}
              {visibleList.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Layer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleList.map((item) => (
                      <tr key={`${item.layer}-${item.id}`}>
                        <td>{item.name}</td>
                        <td>{item.category}</td>
                        <td>{LAYER_LABEL[item.layer]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
