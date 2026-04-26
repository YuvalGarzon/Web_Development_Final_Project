'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authService, Trip } from '@/lib/auth';
import WeatherForecast from '@/components/WeatherForecast';
import Link from 'next/link';

export default function HistoryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; title: string } | null>(null);

  // Check authentication and load trips on mount
  useEffect(() => {
    checkAuthAndLoadTrips();
  }, []);

  const checkAuthAndLoadTrips = async () => {
    const { isAuthenticated } = await authService.checkAuth();
    if (!isAuthenticated) {
      router.push('/login?redirect=/history');
    } else {
      await loadTrips();
      setLoading(false);
    }
  };

  const loadTrips = async () => {
    try {
      const res = await authService.getUserTrips();
      setTrips(res);
    } catch (err) {
      setError('Failed to load trips');
      console.error('Error loading trips:', err);
    }
  };

  const handleDelete = (tripId: string, title: string) => {
    setConfirmDelete({ id: tripId, title });
  };

  const confirmDeleteTrip = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    setDeleting(id);
    const ok = await authService.deleteTrip(id);
    if (ok) {
      setTrips(prev => prev.filter((t: any) => (t._id || t.id) !== id));
    } else {
      setError('Failed to delete trip.');
    }
    setDeleting(null);
  };

  const handleRefreshWeather = async (tripId: string) => {
    setRefreshing(tripId);
    try {
      const refreshed = await loadTrips();
    } finally {
      setRefreshing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your trip history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Trip</h3>
            <p className="text-gray-600 mb-6">
              Delete <span className="font-medium">"{confirmDelete.title}"</span>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteTrip}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          Trip History
        </h1>
        <p className="text-gray-600">
          View your saved trips with updated weather forecasts
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {trips.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 border border-gray-200 text-center">
          <div className="text-6xl mb-6">📋</div>
          <h3 className="text-2xl font-semibold text-gray-900 mb-3">
            No Trips Yet
          </h3>
          <p className="text-gray-600 max-w-md mx-auto mb-8">
            You haven't saved any trips yet. Plan your first adventure and save it to view here.
          </p>
          <Link
            href="/planning"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Plan Your First Trip
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {trips.map((trip: any) => (
            <div
              key={trip._id || trip.id}
              className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden"
            >
              {/* Trip Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {trip.title}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                        {(trip.type === 'hiking' || trip.type === 'trek') ? '🥾 Hiking' : '🚴 Cycling'}
                      </span>
                      <span className="text-gray-600">
                        {trip.distance}km • {trip.duration} day{trip.duration > 1 ? 's' : ''}
                      </span>
                      <span className="text-gray-500 text-sm">
                        Saved on {formatDate(trip.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleRefreshWeather(trip._id || trip.id)}
                      disabled={refreshing === (trip._id || trip.id)}
                      className="px-4 py-2 bg-blue-100 text-blue-700 text-sm font-medium rounded-lg hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {refreshing === (trip._id || trip.id) ? (
                        <span className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-700 mr-2"></div>
                          Refreshing...
                        </span>
                      ) : (
                        '🔄 Refresh Weather'
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(trip._id || trip.id, trip.title)}
                      disabled={deleting === (trip._id || trip.id)}
                      className="px-4 py-2 bg-red-100 text-red-700 text-sm font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {deleting === (trip._id || trip.id) ? 'Deleting...' : '🗑️ Delete'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Trip Content */}
              <div className="p-6">
                <div className="grid lg:grid-cols-3 gap-6">
                  {/* Weather Forecast */}
                  <div className="lg:col-span-2">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        Updated Weather Forecast
                      </h3>
                      <div className="text-sm text-gray-500">
                        Last updated: {new Date(trip.weather.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <WeatherForecast forecast={trip.weather.forecast} />
                  </div>

                  {/* Trip Details */}
                  <div className="space-y-6">
                    {/* Route Info */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h4 className="font-medium text-gray-900 mb-2">
                        Route Information
                      </h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Start:</span>
                          <span className="font-medium">{trip.route.startPoint}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">End:</span>
                          <span className="font-medium">{trip.route.endPoint}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Points:</span>
                          <span className="font-medium">{trip.route.coordinates.length}</span>
                        </div>
                      </div>
                    </div>

                    {/* Destination Image */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">
                        Destination
                      </h4>
                      <div className="relative h-48 rounded-lg overflow-hidden">
                        <img
                          src={trip.imageUrl}
                          alt={trip.title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="space-y-3">
                      <button
                        onClick={() => router.push(`/history/${trip._id || trip.id}`)}
                        className="w-full py-2 px-4 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
                      >
                        View Full Details
                      </button>
                      <button
                        onClick={() =>
                          router.push(
                            `/planning?type=${trip.type}&location=${encodeURIComponent(trip.route.startPoint)}`
                          )
                        }
                        className="w-full py-2 px-4 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Duplicate for New Planning
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Stats */}
      {trips.length > 0 && (
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {trips.length}
            </div>
            <div className="text-gray-600">Total Trips</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {trips.filter(t => t.type === 'hiking' || t.type === 'trek').length}
            </div>
            <div className="text-gray-600">Hiking Trips</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow border border-gray-200">
            <div className="text-3xl font-bold text-gray-900 mb-2">
              {trips.filter(t => t.type === 'cycling' || t.type === 'bicycle').length}
            </div>
            <div className="text-gray-600">Cycling Trips</div>
          </div>
        </div>
      )}

      {/* Information Note */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">
          ℹ️ About Weather Updates
        </h3>
        <p className="text-xs text-gray-600">
          Weather forecasts are automatically updated when you view saved trips. 
          Click "Refresh Weather" to get the latest forecast for the next day. 
          This ensures you always have current information for planning future adventures.
        </p>
      </div>
    </div>
  );
}