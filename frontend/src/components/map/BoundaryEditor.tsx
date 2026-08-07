import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import { calculateAreaSqKm, type BoundingBox } from "../../lib/geo";

interface BoundaryEditorProps {
  /** The starting rectangle to render (e.g. from the city boundary preview). Only used to (re)initialize the layer — dragging/resizing afterwards is entirely client-side. */
  initialBoundary: BoundingBox;
  onChange: (boundary: BoundingBox, areaSqKm: number) => void;
}

function boundsToBoundingBox(bounds: L.LatLngBounds): BoundingBox {
  return {
    minLat: bounds.getSouth(),
    maxLat: bounds.getNorth(),
    minLng: bounds.getWest(),
    maxLng: bounds.getEast(),
  };
}

/**
 * Renders one editable rectangle on the map via leaflet-geoman: draggable
 * (move the whole shape) and resizable (drag a corner handle), reporting
 * the current bounds + area back to the parent on every change. Re-created
 * whenever `initialBoundary` changes identity (i.e. the user picked a
 * different city and a fresh preview boundary arrived).
 */
function EditableRectangle({ initialBoundary, onChange }: BoundaryEditorProps) {
  const map = useMap();
  const rectangleRef = useRef<L.Rectangle | null>(null);
  const boundaryKey = `${initialBoundary.minLat},${initialBoundary.minLng},${initialBoundary.maxLat},${initialBoundary.maxLng}`;

  useEffect(() => {
    const bounds = L.latLngBounds(
      [initialBoundary.minLat, initialBoundary.minLng],
      [initialBoundary.maxLat, initialBoundary.maxLng]
    );
    const rectangle = L.rectangle(bounds, { color: "#2563eb", weight: 2, fillOpacity: 0.08 });
    rectangle.addTo(map);
    rectangle.pm.enable({ draggable: true, allowSelfIntersection: false });
    rectangleRef.current = rectangle;
    map.fitBounds(bounds, { padding: [24, 24] });

    const emitChange = () => {
      const box = boundsToBoundingBox(rectangle.getBounds());
      onChange(box, calculateAreaSqKm(box));
    };
    emitChange();

    rectangle.on("pm:edit", emitChange);
    rectangle.on("pm:dragend", emitChange);
    rectangle.on("pm:markerdragend", emitChange);

    return () => {
      rectangle.off("pm:edit", emitChange);
      rectangle.off("pm:dragend", emitChange);
      rectangle.off("pm:markerdragend", emitChange);
      rectangle.pm.disable();
      map.removeLayer(rectangle);
      rectangleRef.current = null;
    };
    // Only re-run when the *initial* boundary identity changes — the layer
    // manages its own bounds internally afterwards via geoman's edit events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boundaryKey, map]);

  return null;
}

export function BoundaryEditor({ initialBoundary, onChange }: BoundaryEditorProps) {
  const center: [number, number] = [
    (initialBoundary.minLat + initialBoundary.maxLat) / 2,
    (initialBoundary.minLng + initialBoundary.maxLng) / 2,
  ];

  return (
    <div className="boundary-editor-container">
      <MapContainer center={center} zoom={13} style={{ height: "100%", width: "100%" }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <EditableRectangle initialBoundary={initialBoundary} onChange={onChange} />
      </MapContainer>
    </div>
  );
}
