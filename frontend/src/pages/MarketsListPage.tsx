import { Link } from "react-router-dom";
import { useMarkets } from "../api/hooks";
import type { MarketStatus } from "../types";

const STATUS_BADGE: Record<MarketStatus, string> = {
  PENDING: "badge-neutral",
  DISCOVERING: "badge-neutral",
  READY: "badge-success",
  FAILED: "badge-danger",
};

export function MarketsListPage() {
  const { data: markets, isLoading, error } = useMarkets();

  return (
    <div>
      <h1 className="page-title">Markets</h1>
      <p className="page-subtitle">
        A market is a city boundary, a set of store categories, and the stores discovered inside it.
      </p>

      <div className="card">
        {isLoading && <p className="empty-state">Loading markets…</p>}
        {error && <div className="alert alert-danger">Failed to load markets: {error.message}</div>}

        {markets && markets.length === 0 && (
          <div className="empty-state">
            No markets yet. <Link to="/upload">Start by uploading a portfolio</Link>.
          </div>
        )}

        {markets && markets.length > 0 && (
          <div>
            {markets.map((market) => (
              <div className="market-list-item" key={market.id}>
                <div>
                  <div>
                    <strong>{market.name}</strong>{" "}
                    <span className={`badge ${STATUS_BADGE[market.status]}`}>{market.status}</span>
                  </div>
                  <div className="market-list-item__meta">
                    {market.city.name} · {market.areaSqKm.toFixed(1)} sq km · created{" "}
                    {new Date(market.createdAt).toLocaleString()}
                  </div>
                </div>
                <Link to={`/markets/${market.id}`} className="btn">
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <Link to="/upload" className="btn btn-primary">
        + New Market
      </Link>
    </div>
  );
}
