import { NextRequest, NextResponse } from 'next/server';

// Store connected clients (will be managed by Socket.IO server)
const clients = new Set<any>();

// Data generators for different types of real-time data
class DataGenerators {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  startGenerating() {
    this.startOceanographicData();
    this.startPredictionData();
    this.startVesselData();
    this.startSystemAlerts();
  }

  stopGenerating() {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }

  private startOceanographicData() {
    const interval = setInterval(() => {
      const data = {
        type: 'oceanographic',
        timestamp: new Date().toISOString(),
        data: {
          sea_surface_temp: 16 + Math.random() * 8, // 16-24°C
          chlorophyll: 0.3 + Math.random() * 1.2, // 0.3-1.5 mg/m³
          salinity: 33 + Math.random() * 2, // 33-35 PSU
          current_speed: Math.random() * 2, // 0-2 m/s
          current_direction: Math.random() * 360, // 0-360°
          wave_height: Math.random() * 3, // 0-3 m
          wave_period: 8 + Math.random() * 4, // 8-12 s
          wind_speed: Math.random() * 15, // 0-15 m/s
          wind_direction: Math.random() * 360, // 0-360°
        },
        location: {
          latitude: 31.8667 + (Math.random() - 0.5) * 0.5,
          longitude: -116.6167 + (Math.random() - 0.5) * 0.5,
        }
      };

      this.broadcast(data);
    }, 5000); // Every 5 seconds

    this.intervals.set('oceanographic', interval);
  }

  private startPredictionData() {
    const interval = setInterval(() => {
      const data = {
        type: 'prediction',
        timestamp: new Date().toISOString(),
        data: {
          sardine_probability: Math.random(),
          confidence: 0.6 + Math.random() * 0.4, // 60-100%
          optimal_zones: Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
            latitude: 31.8667 + (Math.random() - 0.5) * 1,
            longitude: -116.6167 + (Math.random() - 0.5) * 1,
            radius: 5 + Math.random() * 10, // 5-15 km
            probability: 0.5 + Math.random() * 0.5, // 50-100%
          })),
          migration_pattern: {
            direction: ['north', 'south', 'east', 'west', 'northeast', 'northwest', 'southeast', 'southwest'][Math.floor(Math.random() * 8)],
            speed: 0.5 + Math.random() * 2, // 0.5-2.5 km/h
            confidence: 0.7 + Math.random() * 0.3, // 70-100%
          }
        },
        location: {
          latitude: 31.8667 + (Math.random() - 0.5) * 0.5,
          longitude: -116.6167 + (Math.random() - 0.5) * 0.5,
        }
      };

      this.broadcast(data);
    }, 10000); // Every 10 seconds

    this.intervals.set('prediction', interval);
  }

  private startVesselData() {
    const interval = setInterval(() => {
      const vesselTypes = ['fishing', 'cargo', 'passenger', 'military'];
      const statuses = ['active', 'inactive', 'anchored'];
      
      const data = {
        type: 'vessel',
        timestamp: new Date().toISOString(),
        data: {
          vessels: Array.from({ length: Math.floor(Math.random() * 10) + 5 }, (_, i) => ({
            id: `vessel_${Date.now()}_${i}`,
            name: `Vessel ${i + 1}`,
            type: vesselTypes[Math.floor(Math.random() * vesselTypes.length)] as any,
            latitude: 31.8667 + (Math.random() - 0.5) * 2,
            longitude: -116.6167 + (Math.random() - 0.5) * 2,
            speed: Math.random() * 20, // 0-20 knots
            heading: Math.random() * 360, // 0-360°
            status: statuses[Math.floor(Math.random() * statuses.length)] as any,
          }))
        }
      };

      this.broadcast(data);
    }, 15000); // Every 15 seconds

    this.intervals.set('vessel', interval);
  }

  private startSystemAlerts() {
    const interval = setInterval(() => {
      const alertTypes = ['high_probability', 'breeding_season', 'weather_warning', 'sustainability_alert'];
      const severities = ['low', 'medium', 'high', 'critical'];
      
      // Only send alerts occasionally
      if (Math.random() > 0.7) {
        const data = {
          type: 'alert',
          timestamp: new Date().toISOString(),
          data: {
            type: alertTypes[Math.floor(Math.random() * alertTypes.length)] as any,
            severity: severities[Math.floor(Math.random() * severities.length)] as any,
            message: this.generateAlertMessage(),
            location: Math.random() > 0.3 ? {
              latitude: 31.8667 + (Math.random() - 0.5) * 0.5,
              longitude: -116.6167 + (Math.random() - 0.5) * 0.5,
            } : undefined,
            action_required: Math.random() > 0.5,
            expires_at: Math.random() > 0.5 ? 
              new Date(Date.now() + Math.random() * 3600000).toISOString() : undefined,
          }
        };

        this.broadcast(data);
      }
    }, 30000); // Every 30 seconds

    this.intervals.set('alerts', interval);
  }

  private generateAlertMessage(): string {
    const messages = [
      'High probability of sardine detection in the area',
      'Breeding season alert - fishing restrictions may apply',
      'Weather warning: Strong winds expected in the next 24 hours',
      'Sustainability alert: Catch limits approaching in this zone',
      'Temperature anomaly detected - unusual conditions',
      'Vessel traffic congestion reported in the area',
      'Optimal fishing conditions identified',
      'Migration pattern change detected',
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }

  broadcast(data: any) {
    // This will be handled by Socket.IO server
    // For now, just log the data
    console.log('Broadcasting data:', data.type, 'at', data.timestamp);
  }

  isRunning(): boolean {
    return this.intervals.size > 0;
  }
}

const dataGenerators = new DataGenerators();

// Initialize data generators (Socket.IO server handles connections)
function initializeDataGenerators() {
  if (!dataGenerators.isRunning()) {
    dataGenerators.startGenerating();
  }
}

export async function GET(request: NextRequest) {
  // Initialize data generators if not already running
  initializeDataGenerators();

  return NextResponse.json({
    message: 'WebSocket server initialized',
    connectedClients: clients.size,
    status: 'running'
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    // Handle different types of incoming data
    switch (type) {
      case 'custom_alert':
        // Broadcast custom alert to all clients
        dataGenerators.broadcast({
          type: 'alert',
          timestamp: new Date().toISOString(),
          data: {
            type: data.alertType || 'custom',
            severity: data.severity || 'medium',
            message: data.message || 'Custom alert',
            location: data.location,
            action_required: data.actionRequired || false,
          }
        });
        break;

      case 'update_prediction':
        // Broadcast prediction update
        dataGenerators.broadcast({
          type: 'prediction',
          timestamp: new Date().toISOString(),
          data: data.predictionData
        });
        break;

      case 'system_message':
        // Broadcast system message
        dataGenerators.broadcast({
          type: 'system',
          timestamp: new Date().toISOString(),
          data: data.messageData
        });
        break;

      default:
        return NextResponse.json({ error: 'Unknown message type' }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: 'Data broadcasted successfully' });
  } catch (error) {
    console.error('Error handling POST request:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Cleanup on module unload
process.on('SIGTERM', () => {
  dataGenerators.stopGenerating();
});

process.on('SIGINT', () => {
  dataGenerators.stopGenerating();
});