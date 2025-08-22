/**
 * Real-time WebSocket Service for SARDIN-AI
 * Handles live data streaming for oceanographic updates, sardine predictions, and vessel tracking
 */

import { useEffect, useRef, useCallback } from 'react';

export interface RealtimeData {
  type: 'oceanographic' | 'prediction' | 'vessel' | 'alert' | 'system';
  timestamp: string;
  data: any;
  location?: {
    latitude: number;
    longitude: number;
  };
}

export interface OceanographicUpdate {
  sea_surface_temp: number;
  chlorophyll: number;
  salinity: number;
  current_speed: number;
  current_direction: number;
  wave_height: number;
  wave_period: number;
  wind_speed: number;
  wind_direction: number;
}

export interface PredictionUpdate {
  sardine_probability: number;
  confidence: number;
  optimal_zones: Array<{
    latitude: number;
    longitude: number;
    radius: number;
    probability: number;
  }>;
  migration_pattern: {
    direction: string;
    speed: number;
    confidence: number;
  };
}

export interface VesselUpdate {
  vessels: Array<{
    id: string;
    name: string;
    type: 'fishing' | 'cargo' | 'passenger' | 'military';
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    status: 'active' | 'inactive' | 'anchored';
  }>;
}

export interface AlertUpdate {
  type: 'high_probability' | 'breeding_season' | 'weather_warning' | 'sustainability_alert';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  action_required: boolean;
  expires_at?: string;
}

class RealtimeService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private listeners: Map<string, Array<(data: RealtimeData) => void>> = new Map();
  private connectionStatus: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: RealtimeData[] = [];
  private isProcessingQueue = false;

  constructor() {
    this.connect();
  }

  private connect() {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/realtime`;
      
      this.ws = new WebSocket(wsUrl);
      this.connectionStatus = 'connecting';

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.connectionStatus = 'connected';
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.processMessageQueue();
      };

      this.ws.onmessage = (event) => {
        try {
          const data: RealtimeData = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.connectionStatus = 'disconnected';
        this.stopHeartbeat();
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.connectionStatus = 'disconnected';
      };
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
      this.attemptReconnect();
    }
  }

  private handleMessage(data: RealtimeData) {
    // If we're processing queue, add to queue
    if (this.isProcessingQueue) {
      this.messageQueue.push(data);
      return;
    }

    // Notify all listeners for this data type
    const typeListeners = this.listeners.get(data.type) || [];
    const allListeners = this.listeners.get('*') || [];

    [...typeListeners, ...allListeners].forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Error in WebSocket listener:', error);
      }
    });
  }

  private processMessageQueue() {
    if (this.isProcessingQueue || this.messageQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    // Process messages in order
    const processNext = () => {
      if (this.messageQueue.length === 0) {
        this.isProcessingQueue = false;
        return;
      }

      const message = this.messageQueue.shift();
      if (message) {
        this.handleMessage(message);
        // Process next message with small delay to prevent blocking
        setTimeout(processNext, 0);
      }
    };

    processNext();
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
      }
    }, 30000); // Send heartbeat every 30 seconds
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  public subscribe(type: string, callback: (data: RealtimeData) => void): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }

    this.listeners.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const typeListeners = this.listeners.get(type);
      if (typeListeners) {
        const index = typeListeners.indexOf(callback);
        if (index > -1) {
          typeListeners.splice(index, 1);
        }
      }
    };
  }

  public unsubscribeAll() {
    this.listeners.clear();
  }

  public getConnectionStatus() {
    return this.connectionStatus;
  }

  public send(data: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  public disconnect() {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.unsubscribeAll();
  }
}

// Global instance
export const realtimeService = new RealtimeService();

// React hook for real-time data
export function useRealtimeData<T>(
  type: string,
  callback: (data: RealtimeData) => T,
  deps: any[] = []
): T | null {
  const [data, setData] = useState<T | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Subscribe to real-time updates
  useEffect(() => {
    const handleData = (realtimeData: RealtimeData) => {
      try {
        const processedData = callbackRef.current(realtimeData);
        setData(processedData);
      } catch (error) {
        console.error('Error processing real-time data:', error);
      }
    };

    const unsubscribe = realtimeService.subscribe(type, handleData);

    return () => {
      unsubscribe();
    };
  }, [type, ...deps]);

  return data;
}

// Specific hooks for different data types
export function useOceanographicData() {
  return useRealtimeData<OceanographicUpdate>(
    'oceanographic',
    (data: RealtimeData) => data.data as OceanographicUpdate
  );
}

export function usePredictionData() {
  return useRealtimeData<PredictionUpdate>(
    'prediction',
    (data: RealtimeData) => data.data as PredictionUpdate
  );
}

export function useVesselData() {
  return useRealtimeData<VesselUpdate>(
    'vessel',
    (data: RealtimeData) => data.data as VesselUpdate
  );
}

export function useAlertData() {
  return useRealtimeData<AlertUpdate>(
    'alert',
    (data: RealtimeData) => data.data as AlertUpdate
  );
}

// Hook for connection status
export function useConnectionStatus() {
  const [status, setStatus] = useState(realtimeService.getConnectionStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(realtimeService.getConnectionStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return status;
}

// Hook for real-time location-based data
export function useLocationRealtimeData(
  latitude: number,
  longitude: number,
  radius: number = 10,
  type: string
) {
  return useRealtimeData(
    type,
    (data: RealtimeData) => {
      if (!data.location) return null;
      
      const distance = calculateDistance(
        latitude,
        longitude,
        data.location.latitude,
        data.location.longitude
      );
      
      return distance <= radius ? data.data : null;
    },
    [latitude, longitude, radius, type]
  );
}

// Utility function to calculate distance between two coordinates
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Real-time data processor for complex scenarios
export class RealtimeDataProcessor {
  private buffer: Map<string, RealtimeData[]> = new Map();
  private bufferSize = 10;
  private processingInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startProcessing();
  }

  private startProcessing() {
    this.processingInterval = setInterval(() => {
      this.processBufferedData();
    }, 1000); // Process every second
  }

  public addData(data: RealtimeData) {
    const key = `${data.type}-${data.location?.latitude || 0}-${data.location?.longitude || 0}`;
    
    if (!this.buffer.has(key)) {
      this.buffer.set(key, []);
    }

    const typeBuffer = this.buffer.get(key)!;
    typeBuffer.push(data);

    // Keep only the most recent data points
    if (typeBuffer.length > this.bufferSize) {
      typeBuffer.shift();
    }
  }

  private processBufferedData() {
    for (const [key, dataPoints] of this.buffer.entries()) {
      if (dataPoints.length < 2) continue;

      // Process different types of data
      const type = key.split('-')[0];
      
      switch (type) {
        case 'oceanographic':
          this.processOceanographicData(dataPoints);
          break;
        case 'prediction':
          this.processPredictionData(dataPoints);
          break;
        case 'vessel':
          this.processVesselData(dataPoints);
          break;
      }
    }
  }

  private processOceanographicData(dataPoints: RealtimeData[]) {
    // Calculate trends and anomalies
    const temps = dataPoints.map(d => (d.data as OceanographicUpdate).sea_surface_temp);
    const avgTemp = temps.reduce((a, b) => a + b, 0) / temps.length;
    const tempTrend = temps[temps.length - 1] - temps[0];

    // Detect anomalies (more than 2 standard deviations from mean)
    const stdDev = Math.sqrt(temps.reduce((sq, n) => sq + Math.pow(n - avgTemp, 2), 0) / temps.length);
    const anomalies = temps.filter(t => Math.abs(t - avgTemp) > 2 * stdDev);

    if (anomalies.length > 0) {
      // Emit anomaly alert
      realtimeService.send({
        type: 'alert',
        timestamp: new Date().toISOString(),
        data: {
          type: 'temperature_anomaly',
          severity: 'medium',
          message: `Temperature anomaly detected: ${anomalies.length} readings outside normal range`,
          action_required: true
        }
      });
    }
  }

  private processPredictionData(dataPoints: RealtimeData[]) {
    // Analyze prediction confidence trends
    const confidences = dataPoints.map(d => (d.data as PredictionUpdate).confidence);
    const avgConfidence = confidences.reduce((a, b) => a + b, 0) / confidences.length;
    
    // If confidence is consistently high, create high-probability alert
    if (avgConfidence > 0.8 && confidences.every(c => c > 0.7)) {
      const latestData = dataPoints[dataPoints.length - 1];
      realtimeService.send({
        type: 'alert',
        timestamp: new Date().toISOString(),
        data: {
          type: 'high_probability',
          severity: 'high',
          message: 'High probability sardine detection zone identified',
          location: latestData.location,
          action_required: true
        }
      });
    }
  }

  private processVesselData(dataPoints: RealtimeData[]) {
    // Analyze vessel traffic patterns
    const vessels = dataPoints.flatMap(d => (d.data as VesselUpdate).vessels);
    const fishingVessels = vessels.filter(v => v.type === 'fishing');
    
    // Detect fishing vessel concentration
    if (fishingVessels.length > 5) {
      const avgLat = fishingVessels.reduce((sum, v) => sum + v.latitude, 0) / fishingVessels.length;
      const avgLon = fishingVessels.reduce((sum, v) => sum + v.longitude, 0) / fishingVessels.length;
      
      realtimeService.send({
        type: 'alert',
        timestamp: new Date().toISOString(),
        data: {
          type: 'vessel_concentration',
          severity: 'medium',
          message: `High concentration of fishing vessels detected`,
          location: {
            latitude: avgLat,
            longitude: avgLon
          },
          action_required: false
        }
      });
    }
  }

  public destroy() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    this.buffer.clear();
  }
}

// Global processor instance
export const realtimeDataProcessor = new RealtimeDataProcessor();