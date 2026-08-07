import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../api/client";
import { useCategories, useCities, useCountries, useCreateMarket, usePreviewBoundary, useStates } from "../api/hooks";
import { BoundaryEditor } from "../components/map/BoundaryEditor";
import { MAX_MARKET_AREA_SQ_KM } from "../lib/constants";
import type { BoundingBox } from "../lib/geo";

export function MarketSetupPage() {
  const navigate = useNavigate();

  const { data: countries } = useCountries();
  const [countryId, setCountryId] = useState<number | null>(null);
  const { data: states } = useStates(countryId);
  const [stateId, setStateId] = useState<number | null>(null);
  const { data: cities } = useCities(stateId);
  const [cityId, setCityId] = useState<number | null>(null);

  const { data: categories } = useCategories();
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const previewBoundary = usePreviewBoundary();
  const createMarket = useCreateMarket();

  const [boundary, setBoundary] = useState<BoundingBox | null>(null);
  const [areaSqKm, setAreaSqKm] = useState(0);

  // Intentionally only re-runs on cityId — previewBoundary is a stable
  // mutation object whose identity we don't want to trigger this effect.
  useEffect(() => {
    if (cityId === null) return;
    setBoundary(null);
    previewBoundary.mutate(cityId, {
      onSuccess: (preview) => {
        setBoundary(preview.boundary);
        setAreaSqKm(preview.areaSqKm);
      },
    });
  }, [cityId]); // eslint-disable-line react-hooks/exhaustive-deps -- see comment above

  function toggleCategory(id: number) {
    setCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
  }

  const overLimit = areaSqKm > MAX_MARKET_AREA_SQ_KM;
  const canSubmit = boundary !== null && categoryIds.length > 0 && !overLimit && !createMarket.isPending;

  function handleCreate() {
    if (!cityId || !boundary) return;
    createMarket.mutate(
      { cityId, categoryIds, boundary },
      { onSuccess: (market) => navigate(`/markets/${market.id}`) }
    );
  }

  return (
    <div>
      <h1 className="page-title">Step 2 · Define your market</h1>
      <p className="page-subtitle">
        Pick a location and store categories, then adjust the boundary before creating the market.
      </p>

      <div className="card">
        <h2>Location</h2>
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="country-select">Country</label>
            <select
              id="country-select"
              value={countryId ?? ""}
              onChange={(e) => {
                setCountryId(Number(e.target.value) || null);
                setStateId(null);
                setCityId(null);
              }}
            >
              <option value="">Select country</option>
              {countries?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="state-select">State</label>
            <select
              id="state-select"
              value={stateId ?? ""}
              disabled={!countryId}
              onChange={(e) => {
                setStateId(Number(e.target.value) || null);
                setCityId(null);
              }}
            >
              <option value="">Select state</option>
              {states?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <label htmlFor="city-select">City</label>
            <select
              id="city-select"
              value={cityId ?? ""}
              disabled={!stateId}
              onChange={(e) => setCityId(Number(e.target.value) || null)}
            >
              <option value="">Select city</option>
              {cities?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Categories</h2>
        <p className="page-subtitle" style={{ marginBottom: "0.75rem" }}>
          Only stores matching the selected categories will be discovered.
        </p>
        <div className="checkbox-list">
          {categories?.map((cat) => (
            <label key={cat.id} className={`checkbox-chip ${categoryIds.includes(cat.id) ? "checked" : ""}`}>
              <input
                type="checkbox"
                checked={categoryIds.includes(cat.id)}
                onChange={() => toggleCategory(cat.id)}
                style={{ display: "none" }}
              />
              {cat.name}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Boundary</h2>
        {!cityId && <p className="empty-state">Select a city above to load its boundary.</p>}
        {cityId && previewBoundary.isPending && (
          <p className="empty-state">
            <span className="spinner" /> Looking up city boundary…
          </p>
        )}
        {cityId && previewBoundary.isError && (
          <div className="alert alert-danger">Couldn't determine a boundary for this city. Try again.</div>
        )}

        {boundary && (
          <>
            <BoundaryEditor
              initialBoundary={boundary}
              onChange={(b, area) => {
                setBoundary(b);
                setAreaSqKm(area);
              }}
            />
            <div className={`area-readout ${overLimit ? "over-limit" : ""}`}>
              <span>
                Boundary area: <strong>{areaSqKm.toFixed(1)}</strong> / {MAX_MARKET_AREA_SQ_KM} sq km
              </span>
              {overLimit && <span>Shrink the rectangle to continue</span>}
            </div>
            <p className="page-subtitle" style={{ marginBottom: 0 }}>
              Drag a corner to resize, drag the shape to move it. A larger boundary means more Places API calls —
              discovery is capped at {MAX_MARKET_AREA_SQ_KM} sq km.
            </p>
          </>
        )}
      </div>

      {createMarket.isError && (
        <div className="alert alert-danger">
          {createMarket.error instanceof ApiError ? createMarket.error.message : "Failed to create market."}
        </div>
      )}

      <button className="btn btn-primary" disabled={!canSubmit} onClick={handleCreate}>
        {createMarket.isPending ? (
          <>
            <span className="spinner" /> Creating…
          </>
        ) : (
          "Create Market"
        )}
      </button>
    </div>
  );
}
