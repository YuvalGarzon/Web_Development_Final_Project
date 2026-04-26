// AI Service for Afeka Trip Planner 2026
// Supports OpenAI, Claude, and Gemini with user-provided API keys
// Integrated with local backend that handles the actual LLM generation

export type AIProvider = 'openai' | 'gemini';

export interface TripGenerationRequest {
  provider: AIProvider;
  tripType: 'hiking' | 'cycling' | 'trek' | 'bicycle';
  location: string;
  preferences?: string;
}

export interface GeneratedTrip {
  title: string;
  description: string;
  coordinates: [number, number][];
  startPoint: string;
  endPoint: string;
  distance: number;
  duration: number;
  difficulty: 'easy' | 'moderate' | 'challenging';
  highlights: string[];
  recommendations: string[];
}

export interface AIError {
  message: string;
  provider: AIProvider;
  code?: string;
}

class AIService {
  // Generate a trip using the selected AI provider via our backend
  async generateTrip(request: TripGenerationRequest): Promise<{trip: GeneratedTrip, weather: any, image: string} | AIError> {
    try {
      const typeMap = {
        'hiking': 'trek',
        'trek': 'trek',
        'cycling': 'bicycle',
        'bicycle': 'bicycle'
      };
      
      const mappedType = typeMap[request.tripType] || 'trek';
      const duration = 3;

      const response = await fetch('http://localhost:4000/api/trips/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getCookie('access_token')}` // We assume cookie is sent automatically if credentials: 'include', but fetch in Next.js might need it depending on how auth is handled. In this project auth uses httpOnly cookies, so just use credentials: include.
        },
        credentials: 'include',
        body: JSON.stringify({
          location: request.location,
          type: mappedType,
          duration: duration,
          provider: request.provider,
          preferences: request.preferences
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate trip. Please try again.');
      }

      const data = await response.json();
      return data; // Returns { trip, image, weather } from backend
    } catch (error) {
      return {
        message: error instanceof Error ? error.message : 'The AI model is temporarily unavailable. Please try again in a few seconds.',
        provider: request.provider,
        code: 'AI_ERROR',
      };
    }
  }

  // Get cookie helper just in case, though fetch with credentials: 'include' handles httpOnly cookies.
  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
  }

  // Get provider display name
  getProviderDisplayName(provider: AIProvider): string {
    switch (provider) {
      case 'openai': return 'OpenAI (GPT-4o)';
      case 'gemini': return 'Gemini (Google)';
      default: return provider;
    }
  }

  // Get provider documentation URL
  getProviderDocsUrl(provider: AIProvider): string {
    switch (provider) {
      case 'openai': return 'https://platform.openai.com/api-keys';
      case 'gemini': return 'https://makersuite.google.com/app/apikey';
      default: return '#';
    }
  }
}

// Export singleton instance
export const aiService = new AIService();