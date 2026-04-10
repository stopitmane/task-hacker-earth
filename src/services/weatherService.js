const axios = require('axios');
const logger = require('../utils/logger');

class WeatherService {
  constructor() {
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseURL = process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5';
  }

  // Get historical weather data for claim verification
  async getWeatherHistory(lat, lon, days = 30) {
    try {
      logger.info(`Fetching ${days} days of weather history for location ${lat}, ${lon}`);
      
      // In a real implementation, you'd use a historical weather API
      // For demo purposes, we'll simulate weather data
      const weatherData = this.generateSimulatedWeatherData(days);
      
      return weatherData;
    } catch (error) {
      logger.error('Weather data fetch failed:', error.message);
      throw new Error(`Weather API error: ${error.message}`);
    }
  }

  // Get current weather conditions
  async getCurrentWeather(lat, lon) {
    try {
      if (!this.apiKey) {
        // Return simulated data if no API key
        return this.generateSimulatedCurrentWeather();
      }

      const response = await axios.get(`${this.baseURL}/weather`, {
        params: {
          lat,
          lon,
          appid: this.apiKey,
          units: 'metric'
        }
      });

      const { main, weather, wind, rain } = response.data;
      
      return {
        temperature: main.temp,
        humidity: main.humidity,
        pressure: main.pressure,
        description: weather[0].description,
        windSpeed: wind.speed,
        precipitation: rain ? rain['1h'] || 0 : 0,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Current weather fetch failed:', error.message);
      return this.generateSimulatedCurrentWeather();
    }
  }

  // Generate simulated weather data for demo purposes
  generateSimulatedWeatherData(days) {
    const data = [];
    const now = new Date();
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // Simulate realistic weather patterns for Sub-Saharan Africa
      const isRainySeason = this.isRainySeason(date);
      
      data.push({
        date: date.toISOString().split('T')[0],
        temperature: this.randomBetween(isRainySeason ? 22 : 28, isRainySeason ? 30 : 38),
        humidity: this.randomBetween(isRainySeason ? 70 : 40, isRainySeason ? 90 : 70),
        precipitation: this.generatePrecipitation(isRainySeason),
        windSpeed: this.randomBetween(2, 12),
        pressure: this.randomBetween(1010, 1025)
      });
    }
    
    return data.reverse(); // Return chronological order
  }

  generateSimulatedCurrentWeather() {
    const now = new Date();
    const isRainySeason = this.isRainySeason(now);
    
    return {
      temperature: this.randomBetween(isRainySeason ? 22 : 28, isRainySeason ? 30 : 38),
      humidity: this.randomBetween(isRainySeason ? 70 : 40, isRainySeason ? 90 : 70),
      pressure: this.randomBetween(1010, 1025),
      description: isRainySeason ? 'partly cloudy' : 'clear sky',
      windSpeed: this.randomBetween(2, 12),
      precipitation: this.generatePrecipitation(isRainySeason),
      timestamp: new Date().toISOString()
    };
  }

  // Determine if it's rainy season (simplified for Sub-Saharan Africa)
  isRainySeason(date) {
    const month = date.getMonth() + 1; // 1-12
    // Rainy season typically May-October in many SSA regions
    return month >= 5 && month <= 10;
  }

  // Generate realistic precipitation data
  generatePrecipitation(isRainySeason) {
    if (!isRainySeason) {
      // Dry season - mostly 0, occasional light rain
      return Math.random() < 0.1 ? this.randomBetween(0, 5) : 0;
    } else {
      // Rainy season - more variable
      const rand = Math.random();
      if (rand < 0.3) return 0; // No rain
      if (rand < 0.7) return this.randomBetween(1, 25); // Light to moderate
      if (rand < 0.9) return this.randomBetween(25, 75); // Heavy rain
      return this.randomBetween(75, 150); // Very heavy rain/storms
    }
  }

  // Analyze weather patterns for claim validation
  analyzeWeatherPatterns(weatherData, claimType) {
    switch (claimType) {
      case 'drought':
        return this.analyzeDroughtConditions(weatherData);
      case 'flood':
        return this.analyzeFloodConditions(weatherData);
      case 'storm':
        return this.analyzeStormConditions(weatherData);
      default:
        return { severity: 'unknown', confidence: 0 };
    }
  }

  analyzeDroughtConditions(weatherData) {
    const totalPrecipitation = weatherData.reduce((sum, day) => sum + day.precipitation, 0);
    const avgPrecipitation = totalPrecipitation / weatherData.length;
    const dryDays = weatherData.filter(day => day.precipitation < 1).length;
    const dryStreak = this.calculateLongestDryStreak(weatherData);
    
    let severity = 'none';
    let confidence = 0;
    
    if (dryStreak >= 21 && avgPrecipitation < 2) {
      severity = 'severe';
      confidence = 95;
    } else if (dryStreak >= 14 && avgPrecipitation < 5) {
      severity = 'moderate';
      confidence = 80;
    } else if (dryStreak >= 7 && avgPrecipitation < 10) {
      severity = 'mild';
      confidence = 60;
    }
    
    return {
      severity,
      confidence,
      metrics: {
        totalPrecipitation,
        avgPrecipitation,
        dryDays,
        longestDryStreak: dryStreak
      }
    };
  }

  analyzeFloodConditions(weatherData) {
    const maxDailyPrecipitation = Math.max(...weatherData.map(day => day.precipitation));
    const heavyRainDays = weatherData.filter(day => day.precipitation > 50).length;
    const totalPrecipitation = weatherData.reduce((sum, day) => sum + day.precipitation, 0);
    
    let severity = 'none';
    let confidence = 0;
    
    if (maxDailyPrecipitation > 100 || heavyRainDays >= 3) {
      severity = 'severe';
      confidence = 90;
    } else if (maxDailyPrecipitation > 75 || heavyRainDays >= 2) {
      severity = 'moderate';
      confidence = 75;
    } else if (maxDailyPrecipitation > 50) {
      severity = 'mild';
      confidence = 50;
    }
    
    return {
      severity,
      confidence,
      metrics: {
        maxDailyPrecipitation,
        heavyRainDays,
        totalPrecipitation
      }
    };
  }

  analyzeStormConditions(weatherData) {
    const maxWindSpeed = Math.max(...weatherData.map(day => day.windSpeed));
    const stormDays = weatherData.filter(day => day.windSpeed > 15 && day.precipitation > 25).length;
    
    let severity = 'none';
    let confidence = 0;
    
    if (maxWindSpeed > 25 && stormDays >= 2) {
      severity = 'severe';
      confidence = 85;
    } else if (maxWindSpeed > 20 || stormDays >= 1) {
      severity = 'moderate';
      confidence = 70;
    }
    
    return {
      severity,
      confidence,
      metrics: {
        maxWindSpeed,
        stormDays
      }
    };
  }

  calculateLongestDryStreak(weatherData) {
    let maxStreak = 0;
    let currentStreak = 0;
    
    for (const day of weatherData) {
      if (day.precipitation < 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    return maxStreak;
  }

  randomBetween(min, max) {
    return Math.round((Math.random() * (max - min) + min) * 100) / 100;
  }
}

module.exports = new WeatherService();