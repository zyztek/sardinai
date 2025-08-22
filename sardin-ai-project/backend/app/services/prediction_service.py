import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
import os
import json
import math
import random

class PredictionService:
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self.load_models()
        
    def load_models(self):
        """
        Load or initialize machine learning models
        """
        try:
            # Initialize models for different species
            self.models['sardina'] = RandomForestRegressor(n_estimators=100, random_state=42)
            self.models['atun'] = RandomForestRegressor(n_estimators=100, random_state=42)
            self.models['general'] = RandomForestRegressor(n_estimators=100, random_state=42)
            
            # Initialize scalers
            self.scalers['sardina'] = StandardScaler()
            self.scalers['atun'] = StandardScaler()
            self.scalers['general'] = StandardScaler()
            
        except Exception as e:
            print(f"Error loading models: {e}")
    
    def predict_fish_location(self, species: str, latitude: float, longitude: float) -> Dict[str, Any]:
        """
        Predict fish location probability based on environmental factors
        """
        try:
            # Get current environmental conditions
            current_time = datetime.utcnow()
            
            # Simulate environmental data (in production, this would come from database)
            environmental_factors = self._get_environmental_factors(latitude, longitude, current_time)
            
            # Calculate probability based on species-specific preferences
            if species.lower() == 'sardina':
                probability = self._calculate_sardina_probability(environmental_factors)
            elif species.lower() == 'atun':
                probability = self._calculate_atun_probability(environmental_factors)
            else:
                probability = self._calculate_general_probability(environmental_factors)
            
            # Generate prediction factors
            prediction_factors = {
                'temperature_optimal': environmental_factors['temperature_optimal'],
                'chlorophyll_level': environmental_factors['chlorophyll_level'],
                'salinity_range': environmental_factors['salinity_range'],
                'current_favorable': environmental_factors['current_favorable'],
                'seasonal_factor': environmental_factors['seasonal_factor'],
                'depth_suitable': environmental_factors['depth_suitable'],
                'time_of_day_factor': environmental_factors['time_of_day_factor']
            }
            
            # Calculate confidence interval
            confidence_interval = min(0.95, probability + random.uniform(-0.1, 0.1))
            
            return {
                'probability': round(probability, 2),
                'confidence_interval': round(confidence_interval, 2),
                'factors': prediction_factors,
                'environmental_data': environmental_factors,
                'species': species,
                'location': {
                    'latitude': latitude,
                    'longitude': longitude
                },
                'timestamp': current_time.isoformat(),
                'model_version': '1.0'
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'probability': 0.0,
                'confidence_interval': 0.0,
                'species': species
            }
    
    def _get_environmental_factors(self, latitude: float, longitude: float, current_time: datetime) -> Dict[str, Any]:
        """
        Get environmental factors for prediction
        """
        # Simulate environmental data
        hour = current_time.hour
        day_of_year = current_time.timetuple().tm_yday
        
        # Temperature varies with latitude, season, and time of day
        base_temp = 18.5 + (latitude - 32) * 0.5
        seasonal_temp = 3 * math.sin(2 * math.pi * (day_of_year - 80) / 365)
        daily_temp = 2 * math.sin(2 * math.pi * hour / 24)
        temperature = base_temp + seasonal_temp + daily_temp
        
        # Chlorophyll varies seasonally and with location
        chlorophyll = 0.85 + 0.3 * math.sin(4 * math.pi * (day_of_year - 60) / 365)
        chlorophyll += (longitude + 117) * 0.1
        
        # Salinity (relatively stable)
        salinity = 34.2 + random.uniform(-0.3, 0.3)
        
        # Current speed and direction
        current_speed = 0.6 + 0.3 * math.sin(2 * math.pi * hour / 12)
        current_direction = (hour * 15) % 360
        
        # Depth (surface level for sardines)
        depth = 50.0
        
        return {
            'temperature': round(temperature, 1),
            'chlorophyll': round(chlorophyll, 2),
            'salinity': round(salinity, 2),
            'current_speed': round(current_speed, 1),
            'current_direction': round(current_direction, 0),
            'depth': depth,
            'hour': hour,
            'day_of_year': day_of_year,
            'latitude': latitude,
            'longitude': longitude
        }
    
    def _calculate_sardina_probability(self, factors: Dict[str, Any]) -> float:
        """
        Calculate sardine probability based on environmental factors
        """
        probability = 0.5  # Base probability
        
        # Temperature preference (16-20°C optimal)
        temp = factors['temperature']
        if 16 <= temp <= 20:
            probability += 0.3
        elif 14 <= temp <= 22:
            probability += 0.15
        else:
            probability -= 0.2
        
        # Chlorophyll preference (0.5-1.2 mg/m³ optimal)
        chlorophyll = factors['chlorophyll']
        if 0.5 <= chlorophyll <= 1.2:
            probability += 0.2
        elif 0.3 <= chlorophyll <= 1.5:
            probability += 0.1
        else:
            probability -= 0.1
        
        # Salinity preference (33.5-34.5 PSU optimal)
        salinity = factors['salinity']
        if 33.5 <= salinity <= 34.5:
            probability += 0.1
        else:
            probability -= 0.05
        
        # Current factors
        current_speed = factors['current_speed']
        if 0.3 <= current_speed <= 1.0:
            probability += 0.1
        else:
            probability -= 0.05
        
        # Seasonal factors (higher probability in spring and fall)
        day_of_year = factors['day_of_year']
        if 60 <= day_of_year <= 150:  # Spring
            probability += 0.15
        elif 240 <= day_of_year <= 330:  # Fall
            probability += 0.15
        elif 150 <= day_of_year <= 240:  # Summer
            probability += 0.05
        else:  # Winter
            probability -= 0.1
        
        # Time of day factors
        hour = factors['hour']
        if 6 <= hour <= 18:  # Daytime
            probability += 0.1
        else:  # Nighttime
            probability -= 0.05
        
        # Ensure probability is between 0 and 1
        return max(0.0, min(1.0, probability))
    
    def _calculate_atun_probability(self, factors: Dict[str, Any]) -> float:
        """
        Calculate tuna probability based on environmental factors
        """
        probability = 0.4  # Base probability (lower than sardines)
        
        # Temperature preference (18-24°C optimal)
        temp = factors['temperature']
        if 18 <= temp <= 24:
            probability += 0.3
        elif 16 <= temp <= 26:
            probability += 0.15
        else:
            probability -= 0.2
        
        # Chlorophyll preference (0.3-0.8 mg/m³ optimal)
        chlorophyll = factors['chlorophyll']
        if 0.3 <= chlorophyll <= 0.8:
            probability += 0.15
        elif 0.2 <= chlorophyll <= 1.0:
            probability += 0.08
        else:
            probability -= 0.1
        
        # Current factors (tuna prefer stronger currents)
        current_speed = factors['current_speed']
        if 0.8 <= current_speed <= 2.0:
            probability += 0.2
        elif 0.5 <= current_speed <= 2.5:
            probability += 0.1
        else:
            probability -= 0.1
        
        # Seasonal factors
        day_of_year = factors['day_of_year']
        if 120 <= day_of_year <= 270:  # Summer to fall
            probability += 0.2
        else:
            probability -= 0.1
        
        return max(0.0, min(1.0, probability))
    
    def _calculate_general_probability(self, factors: Dict[str, Any]) -> float:
        """
        Calculate general fish probability
        """
        probability = 0.3  # Base probability
        
        # Temperature preference (15-25°C acceptable range)
        temp = factors['temperature']
        if 15 <= temp <= 25:
            probability += 0.25
        elif 12 <= temp <= 28:
            probability += 0.1
        else:
            probability -= 0.15
        
        # Chlorophyll presence
        chlorophyll = factors['chlorophyll']
        if chlorophyll > 0.3:
            probability += 0.15
        else:
            probability -= 0.1
        
        # Current factors
        current_speed = factors['current_speed']
        if 0.2 <= current_speed <= 1.5:
            probability += 0.1
        else:
            probability -= 0.05
        
        return max(0.0, min(1.0, probability))
    
    def optimize_fishing_route(self, start_lat: float, start_lon: float, 
                             end_lat: float, end_lon: float, species: str,
                             waypoints: List[Dict[str, float]] = None) -> Dict[str, Any]:
        """
        Optimize fishing route based on fish predictions
        """
        try:
            if waypoints is None:
                waypoints = []
            
            # Generate route waypoints
            route_waypoints = []
            
            # Add start point
            route_waypoints.append({
                'latitude': start_lat,
                'longitude': start_lon,
                'type': 'start',
                'probability': 0.0
            })
            
            # Generate intermediate waypoints with fish predictions
            num_waypoints = max(3, int(abs(start_lat - end_lat) + abs(start_lon - end_lon)) * 2)
            
            for i in range(num_waypoints):
                # Interpolate position
                t = (i + 1) / (num_waypoints + 1)
                lat = start_lat + t * (end_lat - start_lat)
                lon = start_lon + t * (end_lon - start_lon)
                
                # Add some randomness to explore different areas
                lat += random.uniform(-0.05, 0.05)
                lon += random.uniform(-0.05, 0.05)
                
                # Get fish prediction for this waypoint
                prediction = self.predict_fish_location(species, lat, lon)
                
                route_waypoints.append({
                    'latitude': lat,
                    'longitude': lon,
                    'type': 'waypoint',
                    'probability': prediction['probability'],
                    'factors': prediction['factors']
                })
            
            # Add end point
            route_waypoints.append({
                'latitude': end_lat,
                'longitude': end_lon,
                'type': 'end',
                'probability': 0.0
            })
            
            # Calculate route statistics
            total_distance = self._calculate_route_distance(route_waypoints)
            avg_probability = np.mean([wp['probability'] for wp in route_waypoints if wp['type'] == 'waypoint'])
            max_probability = max([wp['probability'] for wp in route_waypoints if wp['type'] == 'waypoint'])
            
            # Sort waypoints by probability (excluding start and end)
            sorted_waypoints = sorted(
                [wp for wp in route_waypoints if wp['type'] == 'waypoint'],
                key=lambda x: x['probability'],
                reverse=True
            )
            
            return {
                'route_waypoints': route_waypoints,
                'total_distance': round(total_distance, 2),
                'estimated_time': round(total_distance / 10, 1),  # Assuming 10 km/h average speed
                'average_probability': round(avg_probability, 2),
                'max_probability': round(max_probability, 2),
                'best_fishing_spots': sorted_waypoints[:3],
                'species': species,
                'optimization_criteria': 'fish_probability',
                'timestamp': datetime.utcnow().isoformat()
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'route_waypoints': [],
                'total_distance': 0.0,
                'estimated_time': 0.0
            }
    
    def _calculate_route_distance(self, waypoints: List[Dict[str, Any]]) -> float:
        """
        Calculate total distance of route in kilometers
        """
        total_distance = 0.0
        
        for i in range(len(waypoints) - 1):
            lat1, lon1 = waypoints[i]['latitude'], waypoints[i]['longitude']
            lat2, lon2 = waypoints[i + 1]['latitude'], waypoints[i + 1]['longitude']
            
            # Haversine formula
            R = 6371  # Earth's radius in kilometers
            
            lat1_rad = math.radians(lat1)
            lat2_rad = math.radians(lat2)
            delta_lat = math.radians(lat2 - lat1)
            delta_lon = math.radians(lon2 - lon1)
            
            a = math.sin(delta_lat/2)**2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(delta_lon/2)**2
            c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
            
            distance = R * c
            total_distance += distance
        
        return total_distance