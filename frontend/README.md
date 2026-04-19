# Afeka Trip Planner 2026 - Next.js Frontend

A modern web application for planning hiking and cycling trips with AI-generated routes, weather forecasts, and interactive maps.

## Features

- **Dual JWT Authentication**: Secure login with access tokens (15min) and refresh tokens (1day) stored in httpOnly cookies
- **Silent Refresh**: Automatic token refresh once per day without user interaction
- **AI-Powered Trip Generation**: LLM integration for realistic hiking (5-10km) and cycling (30-70km) routes
- **Interactive Maps**: Leaflet.js integration with route visualization
- **3-Day Weather Forecast**: Real weather data for trip planning
- **Trip History**: Save and review past trips with updated weather forecasts
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Tech Stack

- **Next.js 14+**: App Router, TypeScript, Server Components
- **Authentication**: JWT tokens, httpOnly cookies, middleware protection
- **Maps**: Leaflet.js with OpenStreetMap tiles
- **Styling**: Tailwind CSS with responsive design
- **State Management**: React hooks and context
- **Backend Integration**: Express.js server on port 4000

## Project Structure

```
frontend/
├── app/                    # Next.js App Router pages
│   ├── page.tsx           # Home page
│   ├── login/page.tsx     # Login page
│   ├── register/page.tsx  # Registration page
│   ├── planning/page.tsx  # Trip planning with LLM
│   └── history/page.tsx   # Saved trips history
├── components/            # Reusable components
│   ├── Navigation.tsx     # Main navigation
│   ├── MapComponent.tsx   # Interactive map
│   └── WeatherForecast.tsx # Weather display
├── lib/                   # Utility libraries
│   └── auth.ts           # Authentication service
├── middleware.ts          # Next.js middleware for auth
└── public/               # Static assets
```

## Authentication Flow

1. **Login/Register**: Credentials sent to Express backend (port 4000)
2. **Token Generation**: Backend creates access_token (15min) and refresh_token (1day)
3. **Cookie Storage**: Tokens stored in secure httpOnly cookies
4. **Middleware Protection**: Every page access verified by middleware
5. **Silent Refresh**: Automatic token refresh once per day
6. **Logout**: Tokens cleared from cookies

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Express backend running on http://localhost:4000
- MongoDB database (handled by backend)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```

3. Set up environment variables (copy `.env.local.example` to `.env.local`):
   ```bash
   cp .env.local.example .env.local
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open http://localhost:3000 in your browser

### Environment Variables

Create a `.env.local` file in the frontend directory:

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_MAP_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
NODE_ENV=development
```

## Backend Integration

This frontend is designed to work with the Express.js backend that provides:

- User authentication (register/login/logout/refresh)
- JWT token management
- MongoDB database operations
- Trip data storage

Ensure the backend is running on http://localhost:4000 with CORS configured for http://localhost:3000.

## Key Implementation Details

### Middleware Authentication
- `middleware.ts` verifies JWT tokens on every page request
- Public routes: `/`, `/login`, `/register`
- Protected routes: `/planning`, `/history`, and all others
- Automatic redirect to login for unauthorized access

### Silent Refresh
- Implemented in `lib/auth.ts`
- Runs once per day (24 hours)
- Uses refresh_token from httpOnly cookie
- Updates access_token automatically

### LLM Integration
- Trip generation uses AI models for realistic routes
- Considers terrain, elevation, and points of interest
- Generates non-straight-line paths for natural routes
- Includes weather forecasts and destination images

### Map Integration
- Leaflet.js for interactive maps
- OpenStreetMap tiles
- Route visualization with markers and polylines
- Responsive design for all screen sizes

## Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint (if enabled)

### Code Style

- TypeScript for type safety
- Tailwind CSS for styling
- React hooks for state management
- Functional components with proper typing

## Deployment

### Vercel (Recommended)

1. Push code to GitHub/GitLab
2. Import project in Vercel
3. Configure environment variables
4. Deploy automatically on push

### Other Platforms

- Set `NODE_ENV=production`
- Build with `npm run build`
- Start with `npm start`
- Ensure backend URL is correctly configured

## Security Considerations

- JWT tokens stored in httpOnly cookies
- CSRF protection via same-site cookies
- Environment variables for sensitive data
- TypeScript for compile-time safety
- Input validation on all forms

## License

Academic project for Afeka College of Engineering - Web Development Course 2026