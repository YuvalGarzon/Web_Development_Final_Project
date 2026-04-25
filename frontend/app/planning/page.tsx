'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { authService, Trip } from '@/lib/auth';
import { aiService, AIProvider, GeneratedTrip as AIGeneratedTrip } from '@/lib/aiService';
import { reverseGeocode } from '@/lib/geocode';
import type { MapComponentRef } from '@/components/MapComponent';
import dynamic from 'next/dynamic';

const MapComponent = dynamic(() => import('@/components/MapComponent'), { 
  ssr: false,
  loading: () => <div className="h-[400px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center">Loading Map...</div>
});
import WeatherForecast from '@/components/WeatherForecast';

export default function PlanningPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tripType, setTripType] = useState<'hiking' | 'cycling'>(
    (searchParams.get('type') as 'hiking' | 'cycling') || 'hiking'
  );
  const [location, setLocation] = useState(searchParams.get('location') || '');
  const [preferences, setPreferences] = useState('');
  const [aiProvider, setAIProvider] = useState<AIProvider>('openai');
  const [generatedTrip, setGeneratedTrip] = useState<Trip | null>(null);
  const [aiGeneratedData, setAIGeneratedData] = useState<AIGeneratedTrip | null>(null);
  const [pointNames, setPointNames] = useState<string[]>([]);
  const mapRef = useRef<MapComponentRef>(null);
  const [error, setError] = useState('');

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { isAuthenticated } = await authService.checkAuth();
    if (!isAuthenticated) {
      router.push('/login?redirect=/planning');
    } else {
      setLoading(false);
    }
  };

  const reverseGeocodeAll = async (coords: [number, number][], startPoint: string, endPoint: string) => {
    const names: string[] = coords.map((_, i) =>
      i === 0 ? `Start: ${startPoint}` : i === coords.length - 1 ? `End: ${endPoint}` : `Waypoint ${i}`
    );
    setPointNames([...names]);

    for (let i = 1; i < coords.length - 1; i++) {
      const [lat, lon] = coords[i];
      const name = await reverseGeocode(lat, lon);
      if (name) { names[i] = name; setPointNames([...names]); mapRef.current?.updateNames(names, coords); }
      await new Promise(r => setTimeout(r, 300));
    }
  };

  const handleGenerateTrip = async () => {
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }

    setError('');
    setGenerating(true);
    setAIGeneratedData(null);
    setPointNames([]);

    try {
      const result = await aiService.generateTrip({
        provider: aiProvider,
        tripType,
        location: location.trim(),
        preferences: preferences.trim() || undefined,
      });

      if ('message' in result) {
        // This is an error
        setError(`${aiService.getProviderDisplayName(aiProvider)} error: ${result.message}`);
        setGenerating(false);
        return;
      }

      // Success - store AI generated data
      setAIGeneratedData(result.trip);

      // Create a Trip object from AI data
      const trip: Trip = {
        id: 'ai-' + Date.now(),
        title: result.trip.title,
        type: tripType,
        distance: result.trip.distance,
        duration: result.trip.duration,
        route: {
          coordinates: result.trip.coordinates,
          startPoint: result.trip.startPoint,
          endPoint: result.trip.endPoint,
        },
        weather: result.weather,
        imageUrl: result.image,
        createdAt: new Date().toISOString(),
        userId: 'current-user',
      };

      setGeneratedTrip(trip);
      reverseGeocodeAll(result.trip.coordinates, result.trip.startPoint, result.trip.endPoint);
    } catch (error) {
      setError(`Failed to generate trip: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveTrip = async () => {
    if (!generatedTrip) return;

    setSaving(true);
    
    const tripToSave = {
      title: generatedTrip.title,
      type: generatedTrip.type === 'hiking' ? 'trek' : 'bicycle',
      distance: generatedTrip.distance,
      duration: generatedTrip.duration,
      route: generatedTrip.route,
      imageUrl: generatedTrip.imageUrl,
      aiProvider: aiProvider,
      aiGeneratedData: aiGeneratedData,
    };
    
    try {
      const response = await fetch('http://localhost:4000/api/trips/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(tripToSave)
      });
      
      if (!response.ok) {
        throw new Error('Failed to save trip');
      }
      
      alert(`Trip saved successfully! Generated with ${aiService.getProviderDisplayName(aiProvider)}. You can view it in your History page.`);
      setGeneratedTrip(null);
      setAIGeneratedData(null);
      setLocation('');
      setPreferences('');
    } catch (saveError) {
      alert('Error saving trip.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Trip Planning
        </h1>
        <p className="text-gray-600">
          Generate AI-powered hiking or cycling routes with weather forecasts
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left Column: Trip Configuration */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">
              Configure Your Trip
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Trip Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTripType('hiking')}
                    className={`py-3 px-4 rounded-lg border transition-colors ${
                      tripType === 'hiking'
                        ? 'bg-green-100 border-green-300 text-green-800'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl mb-1">🥾</div>
                    <div className="font-medium">Hiking</div>
                    <div className="text-xs mt-1">5-10km circular</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTripType('cycling')}
                    className={`py-3 px-4 rounded-lg border transition-colors ${
                      tripType === 'cycling'
                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                        : 'bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <div className="text-2xl mb-1">🚴</div>
                    <div className="font-medium">Cycling</div>
                    <div className="text-xs mt-1">30-70km city-to-city</div>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., Tel Aviv, Jerusalem, Haifa"
                  disabled={generating}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Enter a city or region in Israel
                </p>
              </div>

              <div>
                <label htmlFor="preferences" className="block text-sm font-medium text-gray-700 mb-2">
                  Preferences (Optional)
                </label>
                <textarea
                  id="preferences"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  placeholder="e.g., scenic views, moderate difficulty, water sources"
                  rows={3}
                  disabled={generating}
                />
                <p className="mt-2 text-sm text-gray-500">
                  Help the AI understand what you're looking for
                </p>
              </div>

              <div>
                <label htmlFor="aiProvider" className="block text-sm font-medium text-gray-700 mb-2">
                  AI Provider
                </label>
                <select
                  id="aiProvider"
                  value={aiProvider}
                  onChange={(e) => setAIProvider(e.target.value as AIProvider)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={generating}
                >
                  <option value="openai">OpenAI (GPT-4)</option>
                  <option value="gemini">Gemini (Google)</option>
                </select>
                <p className="mt-2 text-sm text-gray-500">
                  Choose which AI model to use for route generation
                </p>
              </div>

              <button
                onClick={handleGenerateTrip}
                disabled={generating || !location.trim()}
                className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {generating ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Generating AI Route...
                  </span>
                ) : (
                  'Generate AI Route'
                )}
              </button>

              {generatedTrip && (
                <button
                  onClick={handleSaveTrip}
                  disabled={saving}
                  className="w-full py-3 px-4 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving Trip...' : 'Save This Trip'}
                </button>
              )}
            </div>

            {/* Multi-AI Provider Note */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                🤖 Multi-AI Provider Support
              </h3>
              <p className="text-xs text-blue-800 mb-2">
                Choose from three leading AI providers. Your API key is used only for
                this session and never stored on our servers.
              </p>
              <div className="text-xs text-blue-800 space-y-1">
                <div className="flex items-center">
                  <span className="font-medium mr-2">OpenAI:</span>
                  <span>GPT-4 for detailed route planning</span>
                </div>
                <div className="flex items-center">
                  <span className="font-medium mr-2">Gemini:</span>
                  <span>Google's model for comprehensive analysis</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Generated Trip Display */}
        <div className="lg:col-span-2">
          {generatedTrip ? (
            <div className="space-y-6">
              {/* Trip Header */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {generatedTrip.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {generatedTrip.type === 'hiking' ? '🥾 Hiking' : '🚴 Cycling'}
                      </span>
                      <span className="text-gray-600">
                        {generatedTrip.distance}km • {generatedTrip.duration} day{generatedTrip.duration > 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {aiService.getProviderDisplayName(aiProvider)}
                      </span>
                      {aiGeneratedData && (
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                          aiGeneratedData.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                          aiGeneratedData.difficulty === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {aiGeneratedData.difficulty.charAt(0).toUpperCase() + aiGeneratedData.difficulty.slice(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Generated with</div>
                    <div className="text-lg font-semibold text-gray-900">
                      {aiService.getProviderDisplayName(aiProvider)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Display */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Route Map
                </h3>
                <p className="text-sm text-gray-500 mb-3">Hover over a marker to see its name. Click for coordinates.</p>
                <div className="h-[400px] rounded-lg overflow-hidden border border-gray-300">
                  <MapComponent ref={mapRef} coordinates={generatedTrip.route.coordinates} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">Start Point</div>
                    <div className="font-medium">{generatedTrip.route.startPoint}</div>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-500">End Point</div>
                    <div className="font-medium">{generatedTrip.route.endPoint}</div>
                  </div>
                </div>

                {/* Waypoints list */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700">Waypoints</h3>
                    {pointNames.length > 0 && pointNames.length < generatedTrip.route.coordinates.length && (
                      <span className="text-xs text-gray-400">Loading names… ({pointNames.length}/{generatedTrip.route.coordinates.length})</span>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                    {generatedTrip.route.coordinates.map((coord, i) => {
                      const name = pointNames[i] ?? (i === 0 ? `Start: ${generatedTrip.route.startPoint}` : i === generatedTrip.route.coordinates.length - 1 ? `End: ${generatedTrip.route.endPoint}` : `Waypoint ${i}`);
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

                {/* Day-by-Day Schedule — derived from actual waypoints */}
                {(() => {
                  const coords = generatedTrip.route.coordinates;
                  const numDays = 3;
                  const chunkSize = Math.ceil(coords.length / numDays);
                  const days = Array.from({ length: numDays }, (_, di) => {
                    const start = di * chunkSize;
                    const places = coords.slice(start, start + chunkSize).map((_, j) => {
                      const idx = start + j;
                      return pointNames[idx] || (idx === 0 ? `Start: ${generatedTrip.route.startPoint}` : idx === coords.length - 1 ? `End: ${generatedTrip.route.endPoint}` : `Waypoint ${idx}`);
                    });
                    return { day: di + 1, places };
                  }).filter(d => d.places.length > 0);
                  return (
                    <div className="mt-6">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3">Day-by-Day Schedule</h3>
                      <div className="space-y-3">
                        {days.map((day) => (
                          <div key={day.day} className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                            <div className="text-sm font-semibold text-blue-800 mb-2">Day {day.day}</div>
                            <div className="space-y-1">
                              {day.places.map((place, pi) => (
                                <div key={pi} className="flex items-center gap-2 text-sm text-blue-900">
                                  <span className="w-5 h-5 flex items-center justify-center rounded-full bg-blue-200 text-blue-700 font-bold text-xs flex-shrink-0">{pi + 1}</span>
                                  {place}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* AI-Generated Details */}
              {aiGeneratedData && (
                <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4">
                    AI-Generated Details
                  </h3>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Highlights</h4>
                      <ul className="space-y-2">
                        {aiGeneratedData.highlights.map((highlight, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-green-500 mr-2">✓</span>
                            <span className="text-gray-700">{highlight}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Recommendations</h4>
                      <ul className="space-y-2">
                        {aiGeneratedData.recommendations.map((recommendation, index) => (
                          <li key={index} className="flex items-start">
                            <span className="text-blue-500 mr-2">💡</span>
                            <span className="text-gray-700">{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {aiGeneratedData.description && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium text-gray-900 mb-2">Description</h4>
                      <p className="text-gray-700">{aiGeneratedData.description}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Weather Forecast */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  3-Day Weather Forecast
                </h3>
                <WeatherForecast forecast={generatedTrip.weather.forecast} />
                <div className="mt-4 text-sm text-gray-500">
                  Last updated: {new Date(generatedTrip.weather.updatedAt).toLocaleString()}
                </div>
              </div>

              {/* Destination Image */}
              <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">
                  Destination Preview
                </h3>
                <div className="relative h-64 rounded-lg overflow-hidden">
                  <img
                    src={generatedTrip.imageUrl}
                    alt={generatedTrip.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="text-white font-medium">
                      Representative image of {location}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg p-12 border border-gray-200 h-full flex flex-col items-center justify-center text-center">
              <div className="text-6xl mb-6">🗺️</div>
              <h3 className="text-2xl font-semibold text-gray-900 mb-3">
                No Trip Generated Yet
              </h3>
              <p className="text-gray-600 max-w-md mb-8">
                Configure your trip preferences on the left and click "Generate AI Route" 
                to create a personalized hiking or cycling adventure.
              </p>
              <div className="text-sm text-gray-500">
                Each generated route includes:
                <ul className="mt-2 space-y-1">
                  <li>• AI-optimized realistic path (not straight lines)</li>
                  <li>• Choice of 2 AI providers (OpenAI, Gemini)</li>
                  <li>• 3-day weather forecast</li>
                  <li>• AI-generated highlights and recommendations</li>
                  <li>• Destination image</li>
                  <li>• Interactive map display</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}