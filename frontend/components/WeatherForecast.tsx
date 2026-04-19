'use client';

interface WeatherDay {
  date: string;
  temp: number;
  condition: string;
  precipitation: number;
}

interface WeatherForecastProps {
  forecast: WeatherDay[];
}

export default function WeatherForecast({ forecast }: WeatherForecastProps) {
  const getWeatherIcon = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('sunny')) return '☀️';
    if (lowerCondition.includes('cloudy')) return '☁️';
    if (lowerCondition.includes('rain')) return '🌧️';
    if (lowerCondition.includes('snow')) return '❄️';
    if (lowerCondition.includes('storm')) return '⛈️';
    if (lowerCondition.includes('wind')) return '💨';
    if (lowerCondition.includes('fog') || lowerCondition.includes('mist')) return '🌫️';
    return '⛅';
  };

  const getConditionColor = (condition: string) => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('sunny')) return 'bg-yellow-100 text-yellow-800';
    if (lowerCondition.includes('cloudy')) return 'bg-gray-100 text-gray-800';
    if (lowerCondition.includes('rain')) return 'bg-blue-100 text-blue-800';
    if (lowerCondition.includes('snow')) return 'bg-indigo-100 text-indigo-800';
    if (lowerCondition.includes('storm')) return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {forecast.map((day, index) => (
          <div 
            key={index} 
            className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm"
          >
            <div className="text-center">
              <div className="text-4xl mb-3">{getWeatherIcon(day.condition)}</div>
              
              <div className="mb-2">
                <div className="text-lg font-semibold text-gray-900">
                  {formatDate(day.date)}
                </div>
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mt-2 ${getConditionColor(day.condition)}`}>
                  {day.condition}
                </div>
              </div>
              
              <div className="mt-4">
                <div className="text-3xl font-bold text-gray-900">
                  {day.temp}°C
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Temperature
                </div>
              </div>
              
              <div className="mt-4">
                <div className="flex items-center justify-center">
                  <div className="text-blue-600 mr-2">💧</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {day.precipitation}%
                  </div>
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  Precipitation
                </div>
              </div>
              
              {/* Weather recommendation */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs text-gray-500">
                  {day.precipitation > 50 ? '🌧️ Consider rescheduling' : 
                   day.temp > 30 ? '🔥 Stay hydrated' : 
                   day.temp < 10 ? '🧥 Dress warmly' : 
                   '✅ Perfect conditions'}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Weather summary */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="text-sm font-semibold text-blue-900 mb-2">
          🌤️ Weather Summary
        </h4>
        <p className="text-sm text-blue-800">
          {forecast.some(d => d.precipitation > 50) 
            ? 'Rain is expected during this period. Consider waterproof gear or alternative dates.'
            : forecast.some(d => d.temp > 30)
            ? 'High temperatures expected. Plan for early morning starts and bring plenty of water.'
            : forecast.some(d => d.temp < 10)
            ? 'Cool temperatures expected. Dress in layers and bring warm gear.'
            : 'Excellent weather conditions for your trip! Enjoy your adventure.'}
        </p>
      </div>
    </div>
  );
}