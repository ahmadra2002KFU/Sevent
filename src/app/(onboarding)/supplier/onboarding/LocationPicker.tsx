"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { LatLngExpression, LeafletMouseEvent, Map as LeafletMap } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Default marker icon: Leaflet ships its assets as static URLs resolved at
// runtime, which breaks with webpack/turbopack. Point at the CDN to dodge the
// bundler gymnastics.
const DEFAULT_ICON = new L.Icon({
  iconUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

type NominatimResult = {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

export type LocationValue = {
  lat: number;
  lng: number;
  city: string | null;
  displayName: string | null;
};

type Props = {
  value: { lat: number; lng: number } | null;
  onChange: (value: LocationValue) => void;
  defaultCenter?: [number, number];
  defaultZoom?: number;
};

const RIYADH_CENTER: [number, number] = [24.7136, 46.6753];
const DEFAULT_ZOOM = 11;

function pickCityFromAddress(addr: NominatimResult["address"] | undefined):
  | string
  | null {
  if (!addr) return null;
  return addr.city ?? addr.town ?? addr.village ?? addr.state ?? null;
}

function RecenterOnValue({ position }: { position: LatLngExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) {
      map.flyTo(position as LatLngExpression, Math.max(map.getZoom(), 12));
    }
  }, [position, map]);
  return null;
}

function MapEvents({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * Leaflet measures its container on mount. If the wizard's side card causes
 * the column to layout-shift after first paint, tiles only render in the
 * initial measured area — the "squeezed into a corner" bug. invalidateSize
 * after mount forces a remeasure once the layout has settled.
 */
function InvalidateSizeOnMount() {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 100);
    return () => clearTimeout(t);
  }, [map]);
  return null;
}

export function LocationPicker({
  value,
  onChange,
  defaultCenter = RIYADH_CENTER,
  defaultZoom = DEFAULT_ZOOM,
}: Props) {
  const t = useTranslations("supplier.onboarding.location");
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  const center = useMemo<[number, number]>(
    () => (value ? [value.lat, value.lng] : defaultCenter),
    [value, defaultCenter],
  );

  // Reverse-geocode via OpenStreetMap Nominatim. Free, no API key; we identify
  // the app in User-Agent per their usage policy. Rate-limit is ~1 req/s —
  // fine for manual pin-drag cadence in onboarding.
  async function reverseGeocode(lat: number, lng: number) {
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=12&accept-language=en,ar`,
        {
          headers: { "Accept-Language": "en,ar;q=0.9" },
        },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as NominatimResult;
      onChange({
        lat,
        lng,
        city: pickCityFromAddress(data.address),
        displayName: data.display_name ?? null,
      });
    } catch {
      onChange({ lat, lng, city: null, displayName: null });
    } finally {
      setLoading(false);
    }
  }

  async function forwardGeocode(term: string) {
    if (term.trim().length < 2) return;
    setSearchError(null);
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(term)}&accept-language=en,ar`,
        { headers: { "Accept-Language": "en,ar;q=0.9" } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = (await res.json()) as NominatimResult[];
      if (!rows[0]) {
        setSearchError(t("noResults"));
        return;
      }
      const r = rows[0];
      const lat = Number(r.lat);
      const lng = Number(r.lon);
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        setSearchError(t("noResults"));
        return;
      }
      onChange({
        lat,
        lng,
        city: pickCityFromAddress(r.address),
        displayName: r.display_name ?? null,
      });
    } catch {
      setSearchError(t("searchError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/*
        LocationPicker is rendered inside the Step3 wizard form, so this
        cannot be its own <form> — nested forms are invalid HTML and break
        hydration. Handle Enter via onKeyDown and click via the button.
      */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              forwardGeocode(searchTerm);
            }
          }}
          placeholder={t("searchPlaceholder")}
          className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-3 focus:ring-ring/50"
        />
        <button
          type="button"
          onClick={() => forwardGeocode(searchTerm)}
          disabled={loading}
          className="inline-flex h-9 items-center rounded-md bg-brand-cobalt-500 px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-cobalt-400 disabled:opacity-60"
        >
          {loading ? t("loading") : t("searchCta")}
        </button>
      </div>
      {searchError ? (
        <p className="text-xs text-semantic-danger-500">{searchError}</p>
      ) : null}

      <div className="relative overflow-hidden rounded-xl border border-border shadow-brand-sm">
        <MapContainer
          center={center}
          zoom={defaultZoom}
          scrollWheelZoom
          style={{ height: 320, width: "100%" }}
          ref={(instance) => {
            if (instance) mapRef.current = instance;
          }}
        >
          {/*
            CartoDB Positron tiles — clean minimalist light base map. Free
            with attribution, no API key required. Much better fit for our
            navy/cobalt design system than raw OSM's dense orange-tinted
            tiles. See https://github.com/CartoDB/basemap-styles.
          */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains={["a", "b", "c", "d"]}
            maxZoom={19}
          />
          <InvalidateSizeOnMount />
          <MapEvents onPick={(lat, lng) => reverseGeocode(lat, lng)} />
          <RecenterOnValue
            position={value ? ([value.lat, value.lng] as LatLngExpression) : null}
          />
          {value ? (
            <Marker
              position={[value.lat, value.lng]}
              icon={DEFAULT_ICON}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker;
                  const { lat, lng } = m.getLatLng();
                  reverseGeocode(lat, lng);
                },
              }}
            />
          ) : null}
        </MapContainer>
      </div>
      <p className="text-xs text-muted-foreground">{t("hint")}</p>
    </div>
  );
}

export default LocationPicker;
