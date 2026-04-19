// Authentication service for Afeka Trip Planner 2026
// Integrates with Express backend running on http://localhost:4000
// Uses dual JWT system with access tokens (15min) and refresh tokens (1day)

const API_BASE_URL = typeof window === 'undefined'
    ? (process.env.INTERNAL_API_URL || 'http://backend:4000')
    : (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000');

export interface User {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    submitters?: string[];
}

export interface AuthResponse {
    ok: boolean;
    user?: User;
    error?: string;
}

export interface Trip {
    id: string;
    title: string;
    type: 'hiking' | 'cycling';
    distance: number;
    duration: number; // in days
    route: {
        coordinates: [number, number][];
        startPoint: string;
        endPoint: string;
    };
    weather: {
        forecast: Array<{
            date: string;
            temp: number;
            condition: string;
            precipitation: number;
        }>;
        updatedAt: string;
    };
    imageUrl: string;
    createdAt: string;
    userId: string;
}

class AuthService {
    private refreshInterval: NodeJS.Timeout | null = null;
    private lastRefreshAttempt: number = 0;
    private readonly REFRESH_COOLDOWN = 60000; // 1 minute cooldown between refresh attempts

    // Check if user is authenticated by verifying access token
    async checkAuth(): Promise<{ isAuthenticated: boolean; user: User | null }> {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/me`, {
                method: 'GET',
                credentials: 'include', // Include cookies for JWT tokens
            });

            if (response.ok) {
                const data = await response.json();
                return { isAuthenticated: true, user: data.user };
            }

            // If 401, try to refresh token
            if (response.status === 401) {
                const refreshSuccess = await this.silentRefresh();
                if (refreshSuccess) {
                    return this.checkAuth(); // Retry after refresh
                }
            }

            return { isAuthenticated: false, user: null };
        } catch (error) {
            console.error('Auth check failed:', error);
            return { isAuthenticated: false, user: null };
        }
    }

    // Register new user
    async register(email: string, password: string, firstName: string, lastName: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password, firstName, lastName }),
            });

            const data = await response.json();

            if (response.ok) {
                // Start silent refresh timer after successful registration
                this.startSilentRefresh();
                return { ok: true, user: data.user };
            }

            return { ok: false, error: data.error || 'Registration failed' };
        } catch (error) {
            console.error('Registration failed:', error);
            return { ok: false, error: 'Network error' };
        }
    }

    // Login user
    async login(email: string, password: string): Promise<AuthResponse> {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (response.ok) {
                // Start silent refresh timer after successful login
                this.startSilentRefresh();
                return { ok: true, user: data.user };
            }

            return { ok: false, error: data.error || 'Login failed' };
        } catch (error) {
            console.error('Login failed:', error);
            return { ok: false, error: 'Network error' };
        }
    }

    // Silent refresh - called automatically when access token expires
    async silentRefresh(): Promise<boolean> {
        const now = Date.now();

        // Prevent too frequent refresh attempts
        if (now - this.lastRefreshAttempt < this.REFRESH_COOLDOWN) {
            return false;
        }

        this.lastRefreshAttempt = now;

        try {
            const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                credentials: 'include', // Refresh token is in httpOnly cookie
            });

            if (response.ok) {
                console.log('Token refreshed successfully');
                return true;
            }

            console.warn('Token refresh failed:', response.status);
            return false;
        } catch (error) {
            console.warn('Token refresh network error:', error);
            return false;
        }
    }

    // Start automatic silent refresh (once per day as per requirements)
    startSilentRefresh() {
        // Clear existing interval if any
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Refresh once per day (24 hours) as per professor's requirements
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        this.refreshInterval = setInterval(async () => {
            console.log('Performing daily silent refresh...');
            await this.silentRefresh();
        }, ONE_DAY_MS);

        console.log('Silent refresh scheduled for once per day');
    }

    // Stop silent refresh (on logout)
    stopSilentRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    // Logout user
    async logout(): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/logout`, {
                method: 'POST',
                credentials: 'include',
            });

            // Stop silent refresh on logout
            this.stopSilentRefresh();

            return response.ok;
        } catch (error) {
            console.error('Logout failed:', error);
            return false;
        }
    }

    // Trip-related API calls
    async generateTrip(
        type: 'hiking' | 'cycling',
        location: string,
        preferences?: string
    ): Promise<Trip | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/trips/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ type, location, preferences }),
            });

            if (response.ok) {
                return await response.json();
            }

            console.error('Trip generation failed:', response.status);
            return null;
        } catch (error) {
            console.error('Trip generation network error:', error);
            return null;
        }
    }

    async saveTrip(trip: Omit<Trip, 'id' | 'createdAt' | 'userId'>): Promise<Trip | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/trips`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(trip),
            });

            if (response.ok) {
                return await response.json();
            }

            console.error('Trip save failed:', response.status);
            return null;
        } catch (error) {
            console.error('Trip save network error:', error);
            return null;
        }
    }

    async getUserTrips(): Promise<Trip[]> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/trips/history`, {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                const data = await response.json();
                return data.trips ?? [];
            }

            console.error('Failed to fetch trips:', response.status);
            return [];
        } catch (error) {
            console.error('Failed to fetch trips:', error);
            return [];
        }
    }

    async deleteTrip(tripId: string): Promise<boolean> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`, {
                method: 'DELETE',
                credentials: 'include',
            });
            return response.ok;
        } catch (error) {
            console.warn('Delete trip failed:', error);
            return false;
        }
    }

    async getTripWithUpdatedWeather(tripId: string): Promise<Trip | null> {
        try {
            const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}`, {
                method: 'GET',
                credentials: 'include',
            });

            if (response.ok) {
                return await response.json();
            }

            console.warn('Failed to fetch trip with updated weather:', response.status);
            return null;
        } catch (error) {
            console.warn('Failed to fetch trip with updated weather:', error);
            return null;
        }
    }
}

// Export singleton instance
export const authService = new AuthService();