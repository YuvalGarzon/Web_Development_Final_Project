'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { authService, Trip } from '@/lib/auth';
import { reverseGeocode } from '@/lib/geocode';
import WeatherForecast from '@/components/WeatherForecast';
import type { MapComponentRef } from '@/components/MapComponent';

const MapComponent = dynamic(() => import('@/components/MapComponent'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">
      Loading Map...
    </div>
  ),
});

export default function TripDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pointNames, setPointNames] = useState<string[]>([]);
  const mapRef = useRef<MapComponentRef>(null);

  useEffect(() => {
    loadTrip();
  }, [tripId]);

  const loadTrip = async () => {
    const { isAuthenticated } = await authService.checkAuth();
    if (!isAuthenticated) {
      router.push('/login?redirect=/history');
      return;
    }

    const data = await authService.getTripWithUpdatedWeather(tripId);
    if (!data) {
      setError('Trip not found.');
      setLoading(false);
      return;
    }
    setTrip(data as any);
    setLoading(false);
    reverseGeocodeAll((data as any).route.coordinates, (data as any).route.startPoint, (data as any).route.endPoint);
  };

  const reverseGeocodeAll = async (coords: [number, number][], startPoint: string, endPoint: string) => {
    const names: string[] = coords.map((_, i) =>
      i === 0 ? `Start: ${startPoint}` : i === coords.length - 1 ? `End: ${endPoint}` : `Waypoint ${i}`
    );
    setPointNames([...names]);

    for (let i = 1; i < coords.length - 1; i++) {
      const [lat, lon] = coords[i];
      const name = await reverseGeocode(lat, lon);
      if (name) {
        names[i] = name;
        setPointNames([...names]);
        mapRef.current?.updateNames(names, coords);
      }
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading trip details...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <p className="text-red-600 text-lg mb-4">{error || 'Trip not found.'}</p>
        <Link href="/history" className="text-blue-600 hover:underline">
          ← Back to History
        </Link>
      </div>
    );
  }

  const tripAny = trip as any;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back link + header */}
      <div>
        <Link href="/history" className="text-sm text-blue-600 hover:underline">
          ← Back to History
        </Link>
        <h1 className="text-4xl font-bold text-gray-900 mt-3">{trip.title}</h1>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className="px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
            {trip.type === 'hiking' ? '🥾 Hiking' : '🚴 Cycling'}
          </span>
          <span className="text-gray-600">
            {trip.distance}km • {trip.duration} day{trip.duration > 1 ? 's' : ''}
          </span>
          <span className="text-gray-500 text-sm">Saved on {formatDate(trip.createdAt)}</span>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Map</h2>
        <p className="text-sm text-gray-500 mb-3">Hover over a marker to see its name. Click for coordinates.</p>
        <div className="h-[400px] rounded-lg overflow-hidden border border-gray-300">
          <MapComponent ref={mapRef} coordinates={trip.route.coordinates} />
        </div>

        {/* Waypoints list */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-gray-700">Waypoints</h3>
            {pointNames.length > 0 && pointNames.length < trip.route.coordinates.length && (
              <span className="text-xs text-gray-400">Loading names… ({pointNames.length}/{trip.route.coordinates.length})</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
            {trip.route.coordinates.map((coord, i) => {
              const name = pointNames[i] ?? (i === 0 ? `Start: ${trip.route.startPoint}` : i === trip.route.coordinates.length - 1 ? `End: ${trip.route.endPoint}` : `Waypoint ${i}`);
              return (
                <div key={i} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg text-sm">
                  <span className="w-6 h-6 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex-shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <div className="font-medium text-gray-800">{name}</div>
                    <div className="text-gray-400 text-xs">{coord[0].toFixed(4)}, {coord[1].toFixed(4)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weather */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Weather Forecast</h2>
        <p className="text-sm text-gray-500 mb-4">
          Last updated: {new Date(trip.weather.updatedAt).toLocaleString()}
        </p>
        <WeatherForecast forecast={trip.weather.forecast} />
      </div>

      {/* AI details if present */}
      {tripAny.aiGeneratedData && (
        <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">AI-Generated Details</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {tripAny.aiGeneratedData.highlights?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Highlights</h4>
                <ul className="space-y-2">
                  {tripAny.aiGeneratedData.highlights.map((h: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span className="text-gray-700">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {tripAny.aiGeneratedData.recommendations?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
                <ul className="space-y-2">
                  {tripAny.aiGeneratedData.recommendations.map((r: string, i: number) => (
                    <li key={i} className="flex items-start">
                      <span className="text-blue-500 mr-2">💡</span>
                      <span className="text-gray-700">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {tripAny.aiGeneratedData.description && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Description</h4>
              <p className="text-gray-700">{tripAny.aiGeneratedData.description}</p>
            </div>
          )}
        </div>
      )}

      {/* Destination image */}
      <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Destination</h2>
        <div className="relative h-64 rounded-lg overflow-hidden">
          <img src={trip.imageUrl} alt={trip.title} className="w-full h-full object-cover" />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pb-8">
        <button
          onClick={() =>
            router.push(`/planning?type=${trip.type}&location=${encodeURIComponent(trip.route.startPoint)}`)
          }
          className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Duplicate for New Planning
        </button>
        <button
          onClick={async () => {
            if (!confirm(`Delete "${trip.title}"? This cannot be undone.`)) return;
            const ok = await authService.deleteTrip(tripId);
            if (ok) router.push('/history');
          }}
          className="px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          Delete Trip
        </button>
        <Link
          href="/history"
          className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
        >
          Back to History
        </Link>
      </div>
    </div>
  );
}
