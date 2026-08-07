import type { LayerVisibility } from "./MarketMap";

interface LayerToggleProps {
  visibility: LayerVisibility;
  onChange: (visibility: LayerVisibility) => void;
  counts: { discovered: number; portfolioInside: number; portfolioOutside: number; portfolioUngeocoded: number };
}

const LAYERS: { key: keyof LayerVisibility; label: string; swatch: string; countKey: keyof LayerToggleProps["counts"] }[] = [
  { key: "discovered", label: "Discovered stores", swatch: "#2563eb", countKey: "discovered" },
  { key: "portfolioInside", label: "Portfolio — inside boundary", swatch: "#15803d", countKey: "portfolioInside" },
  { key: "portfolioOutside", label: "Portfolio — outside boundary", swatch: "#b45309", countKey: "portfolioOutside" },
];

export function LayerToggle({ visibility, onChange, counts }: LayerToggleProps) {
  return (
    <div className="layer-toggle-list">
      {LAYERS.map((layer) => (
        <label key={layer.key} className="layer-toggle-item">
          <input
            type="checkbox"
            checked={visibility[layer.key]}
            onChange={() => onChange({ ...visibility, [layer.key]: !visibility[layer.key] })}
          />
          <span className="layer-swatch" style={{ background: layer.swatch }} />
          {layer.label} ({counts[layer.countKey]})
        </label>
      ))}
      {counts.portfolioUngeocoded > 0 && (
        <div className="layer-toggle-item" style={{ color: "var(--color-text-muted)" }}>
          <span className="layer-swatch" style={{ background: "#cbd5e1" }} />
          Portfolio — couldn't be located ({counts.portfolioUngeocoded}), see list
        </div>
      )}
    </div>
  );
}
