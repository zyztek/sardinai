import requests
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import os

class NOAAService:
    def __init__(self):
        self.api_key = os.environ.get('NOAA_API_KEY')
        self.base_url = "https://www.ncdc.noaa.gov/cdo-web/api/v2"
        
    def get_ocean_data(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Fetch oceanographic data from NOAA for given coordinates
        """
        try:
            # For demonstration, return mock data
            # In production, this would make actual API calls to NOAA
            
            # Simulate API response with realistic oceanographic data
            ocean_data = {
                'temperature': round(18.5 + (latitude - 32) * 0.5, 1),  # Temperature varies by latitude
                'chlorophyll': round(0.8 + (longitude + 117) * 0.1, 2),  # Chlorophyll concentration
                'salinity': 34.2,  # Typical ocean salinity
                'current_speed': round(0.5 + (datetime.now().hour % 6) * 0.1, 1),  # Varying current speed
                'current_direction': (datetime.now().hour * 15) % 360,  # Changing direction
                'depth': 50.0,  # Surface depth
                'data_source': 'noaa',
                'timestamp': datetime.utcnow().isoformat(),
                'location': f"NOAA Data ({latitude}, {longitude})"
            }
            
            # Add some realistic variation based on time of day
            hour = datetime.now().hour
            if 6 <= hour <= 18:  # Daytime
                ocean_data['temperature'] += 2.0  # Warmer during day
                ocean_data['chlorophyll'] += 0.2  # Higher chlorophyll during day
            else:  # Nighttime
                ocean_data['temperature'] -= 1.5  # Cooler at night
                ocean_data['chlorophyll'] -= 0.1  # Lower chlorophyll at night
            
            return ocean_data
            
        except Exception as e:
            return {
                'error': str(e),
                'data_source': 'noaa',
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def get_historical_data(self, latitude: float, longitude: float, 
                           start_date: datetime, end_date: datetime) -> List[Dict[str, Any]]:
        """
        Fetch historical oceanographic data from NOAA
        """
        try:
            # Generate mock historical data
            historical_data = []
            current_date = start_date
            
            while current_date <= end_date:
                # Simulate seasonal variations
                day_of_year = current_date.timetuple().tm_yday
                
                # Temperature varies seasonally
                base_temp = 18.5 + 5 * math.sin(2 * math.pi * day_of_year / 365)
                
                # Add daily variation
                daily_variation = 2 * math.sin(2 * math.pi * current_date.hour / 24)
                temperature = base_temp + daily_variation
                
                # Chlorophyll varies seasonally (higher in spring/fall)
                chlorophyll = 0.8 + 0.4 * math.sin(4 * math.pi * day_of_year / 365)
                
                data_point = {
                    'temperature': round(temperature, 1),
                    'chlorophyll': round(chlorophyll, 2),
                    'salinity': 34.2 + random.uniform(-0.5, 0.5),
                    'current_speed': round(random.uniform(0.3, 1.2), 1),
                    'current_direction': random.uniform(0, 360),
                    'depth': 50.0,
                    'data_source': 'noaa',
                    'timestamp': current_date.isoformat(),
                    'location': f"NOAA Historical ({latitude}, {longitude})"
                }
                
                historical_data.append(data_point)
                current_date += timedelta(days=1)
            
            return historical_data
            
        except Exception as e:
            return [{'error': str(e)}]
    
    def get_satellite_data(self, latitude: float, longitude: float, 
                          satellite_type: str = 'temperature') -> Dict[str, Any]:
        """
        Fetch satellite imagery data from NOAA
        """
        try:
            # Mock satellite data
            satellite_data = {
                'satellite_type': satellite_type,
                'latitude': latitude,
                'longitude': longitude,
                'resolution': '4km',
                'timestamp': datetime.utcnow().isoformat(),
                'data_source': 'noaa-satellite',
                'image_url': f'https://coastwatch.pfeg.noaa.gov/erddap/griddap/noaa_satellite_{satellite_type}.png'
            }
            
            if satellite_type == 'temperature':
                satellite_data['value'] = round(18.5 + (latitude - 32) * 0.5, 1)
                satellite_data['unit'] = '°C'
            elif satellite_type == 'chlorophyll':
                satellite_data['value'] = round(0.8 + (longitude + 117) * 0.1, 2)
                satellite_data['unit'] = 'mg/m³'
            else:
                satellite_data['value'] = 0.0
                satellite_data['unit'] = 'unknown'
            
            return satellite_data
            
        except Exception as e:
            return {
                'error': str(e),
                'satellite_type': satellite_type,
                'timestamp': datetime.utcnow().isoformat()
            }
    
    def get_weather_data(self, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Fetch weather data from NOAA
        """
        try:
            # Mock weather data
            weather_data = {
                'temperature': round(22.5 + (latitude - 32) * 0.3, 1),
                'humidity': round(60 + (datetime.now().hour % 12) * 3, 0),
                'wind_speed': round(5 + (datetime.now().hour % 8) * 0.5, 1),
                'wind_direction': (datetime.now().hour * 30) % 360,
                'pressure': 1013.25 + random.uniform(-5, 5),
                'visibility': 10.0,
                'data_source': 'noaa-weather',
                'timestamp': datetime.utcnow().isoformat(),
                'location': f"NOAA Weather ({latitude}, {longitude})"
            }
            
            return weather_data
            
        except Exception as e:
            return {
                'error': str(e),
                'data_source': 'noaa-weather',
                'timestamp': datetime.utcnow().isoformat()
            }