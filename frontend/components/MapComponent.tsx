'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';

const DefaultIcon = L.icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export interface MapComponentRef {
  updateNames: (names: string[], coords: [number, number][]) => void;
}

interface MapComponentProps {
  coordinates: [number, number][];
  center?: [number, number];
  zoom?: number;
}

function safeRemoveMarker(m: L.Marker) {
  try { m.closeTooltip(); m.unbindTooltip(); } catch {}
  try { m.closePopup(); m.unbindPopup(); } catch {}
  try { m.remove(); } catch {}
}

const MapComponent = forwardRef<MapComponentRef, MapComponentProps>(
  ({ coordinates, center = [32.0853, 34.7818], zoom = 12 }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapInstance = useRef<L.Map | null>(null);
    const markersRef = useRef<L.Marker[]>([]);
    const polylineRef = useRef<L.Polyline | null>(null);

    useImperativeHandle(ref, () => ({
      updateNames: (names: string[], coords: [number, number][]) => {
        if (!mapInstance.current) return;
        markersRef.current.forEach((marker, i) => {
          const name = names[i] ?? `Point ${i + 1}`;
          try { marker.closeTooltip(); marker.unbindTooltip(); } catch {}
          try { marker.closePopup(); marker.unbindPopup(); } catch {}
          try {
            marker.bindTooltip(name, { permanent: false, direction: 'top', offset: [0, -40] });
            const c = coords[i];
            if (c) marker.bindPopup(`<strong>${name}</strong><br/><small>${c[0].toFixed(5)}, ${c[1].toFixed(5)}</small>`);
          } catch {}
        });
      },
    }));

    // Effect 1: create map once, destroy on unmount only
    useEffect(() => {
      if (!containerRef.current || mapInstance.current) return;

      mapInstance.current = L.map(containerRef.current, {
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView(center, zoom);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapInstance.current);

      return () => {
        markersRef.current.forEach(safeRemoveMarker);
        markersRef.current = [];
        try { polylineRef.current?.remove(); } catch {}
        polylineRef.current = null;
        try { mapInstance.current?.remove(); } catch {}
        mapInstance.current = null;
      };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Effect 2: update markers when coordinates change
    useEffect(() => {
      if (!mapInstance.current || coordinates.length === 0) return;

      markersRef.current.forEach(safeRemoveMarker);
      markersRef.current = [];
      try { polylineRef.current?.remove(); } catch {}
      polylineRef.current = null;

      coordinates.forEach((coord, i) => {
        const name = `Point ${i + 1}`;
        try {
          const marker = L.marker([coord[0], coord[1]], { icon: DefaultIcon }).addTo(mapInstance.current!);
          marker.bindTooltip(name, { permanent: false, direction: 'top', offset: [0, -40] });
          marker.bindPopup(`<strong>${name}</strong><br/><small>${coord[0].toFixed(5)}, ${coord[1].toFixed(5)}</small>`);
          markersRef.current.push(marker);
        } catch {}
      });

      try {
        const latLngs = coordinates.map(c => [c[0], c[1]] as [number, number]);
        polylineRef.current = L.polyline(latLngs, { color: '#3b82f6', weight: 3 }).addTo(mapInstance.current!);
        const group = new L.FeatureGroup(markersRef.current);
        mapInstance.current.fitBounds(group.getBounds().pad(0.1));
      } catch {}
    }, [coordinates]);

    return (
      <div
        ref={containerRef}
        className="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
        style={{ height: '400px' }}
      />
    );
  }
);

MapComponent.displayName = 'MapComponent';
export default MapComponent;
