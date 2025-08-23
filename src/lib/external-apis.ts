// Servicio de conexión a APIs externas para SARDIN-AI
// Este servicio maneja la conexión con NOAA, CICESE y otras fuentes de datos oceanográficos

import ZAI from 'z-ai-web-dev-sdk';

export interface OceanographicDataPoint {
  latitude: number;
  longitude: number;
  timestamp: string;
  temperature_surface?: number;
  temperature_subsurface?: number;
  salinity?: number;
  chlorophyll?: number;
  dissolved_oxygen?: number;
  current_speed?: number;
  current_direction?: number;
  wave_height?: number;
  wave_period?: number;
  wave_direction?: number;
  wind_speed?: number;
  wind_direction?: number;
  atmospheric_pressure?: number;
}

export interface SatelliteImageData {
  satellite_name: string;
  sensor_type: string;
  acquisition_time: string;
  bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  resolution: number;
  data_type: 'sst' | 'chlorophyll' | 'altimetry' | 'wind' | 'waves';
  file_url: string;
  thumbnail_url?: string;
}

export interface VesselTrafficData {
  mmsi?: number;
  vessel_name?: string;
  vessel_type?: string;
  latitude: number;
  longitude: number;
  course?: number;
  speed?: number;
  heading?: number;
  timestamp: string;
  destination?: string;
  status?: string;
}

export interface WeatherAlert {
  id: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  area: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
  valid_from: string;
  valid_until: string;
}

class ExternalAPIService {
  private zai: ZAI | null = null;
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 10 * 60 * 1000; // 10 minutos

  constructor() {
    this.initializeZAI();
  }

  private async initializeZAI() {
    try {
      this.zai = await ZAI.create();
    } catch (error) {
      console.error('Error initializing ZAI:', error);
    }
  }

  private getCacheKey(service: string, params: any): string {
    return `${service}:${JSON.stringify(params)}`;
  }

  private setCache(key: string, data: any, ttl: number = this.DEFAULT_CACHE_TTL) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  private getCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  private async makeRequest(url: string, options: RequestInit = {}): Promise<any> {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'SARDIN-AI/2.0.0',
          ...options.headers
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error making request to', url, ':', error);
      throw error;
    }
  }

  // NOAA ERDDAP API
  async getNOAAData(
    bounds: { north: number; south: number; east: number; west: number },
    startTime: string,
    endTime: string,
    dataType: 'temperature' | 'chlorophyll' | 'currents' | 'waves'
  ): Promise<OceanographicDataPoint[]> {
    const cacheKey = this.getCacheKey('noaa', { bounds, startTime, endTime, dataType });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      let datasetId: string;
      let variables: string[];

      switch (dataType) {
        case 'temperature':
          datasetId = 'erdMHsstd8day';
          variables = ['sst'];
          break;
        case 'chlorophyll':
          datasetId = 'erdMH1chlamday';
          variables = ['chlorophyll'];
          break;
        case 'currents':
          datasetId = 'erdQAcur8day';
          variables = ['u', 'v'];
          break;
        case 'waves':
          datasetId = 'erdWavH8day';
          variables = ['wave_height', 'wave_period', 'wave_direction'];
          break;
        default:
          throw new Error(`Unknown data type: ${dataType}`);
      }

      const baseUrl = 'https://coastwatch.pfeg.noaa.gov/erddap/griddap';
      const url = `${baseUrl}/${datasetId}.json?${variables.join(',')}[(${startTime}):1:(${endTime})][(${bounds.south}):1:(${bounds.north})][(${bounds.west}):1:(${bounds.east})]`;

      const data = await this.makeRequest(url);
      const processedData = this.processNOAAData(data, dataType);
      
      this.setCache(cacheKey, processedData);
      return processedData;
    } catch (error) {
      console.error('Error fetching NOAA data:', error);
      return [];
    }
  }

  private processNOAAData(rawData: any, dataType: string): OceanographicDataPoint[] {
    try {
      const dataPoints: OceanographicDataPoint[] = [];
      
      if (!rawData || !rawData[`${dataType}_table`]) {
        return dataPoints;
      }

      const tableData = rawData[`${dataType}_table`];
      const rows = tableData.rows || [];
      const columnNames = tableData.columnNames || [];

      for (const row of rows) {
        const dataPoint: OceanographicDataPoint = {
          latitude: row[columnNames.indexOf('latitude')],
          longitude: row[columnNames.indexOf('longitude')],
          timestamp: row[columnNames.indexOf('time')]
        };

        switch (dataType) {
          case 'temperature':
            dataPoint.temperature_surface = row[columnNames.indexOf('sst')];
            break;
          case 'chlorophyll':
            dataPoint.chlorophyll = row[columnNames.indexOf('chlorophyll')];
            break;
          case 'currents':
            const u = row[columnNames.indexOf('u')];
            const v = row[columnNames.indexOf('v')];
            if (u !== null && v !== null) {
              dataPoint.current_speed = Math.sqrt(u * u + v * v);
              dataPoint.current_direction = Math.atan2(v, u) * 180 / Math.PI;
            }
            break;
          case 'waves':
            dataPoint.wave_height = row[columnNames.indexOf('wave_height')];
            dataPoint.wave_period = row[columnNames.indexOf('wave_period')];
            dataPoint.wave_direction = row[columnNames.indexOf('wave_direction')];
            break;
        }

        dataPoints.push(dataPoint);
      }

      return dataPoints;
    } catch (error) {
      console.error('Error processing NOAA data:', error);
      return [];
    }
  }

  // CICESSE Service (simulado - requiere acceso real)
  async getCICESEData(
    bounds: { north: number; south: number; east: number; west: number },
    startTime: string,
    endTime: string
  ): Promise<OceanographicDataPoint[]> {
    const cacheKey = this.getCacheKey('cicese', { bounds, startTime, endTime });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      // Simulación de datos de CICESE - en producción esto se conectaría a la API real
      const mockData: OceanographicDataPoint[] = [];
      const numPoints = 20;

      for (let i = 0; i < numPoints; i++) {
        mockData.push({
          latitude: bounds.south + Math.random() * (bounds.north - bounds.south),
          longitude: bounds.west + Math.random() * (bounds.east - bounds.west),
          timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
          temperature_surface: 16 + Math.random() * 4, // 16-20°C rango típico para Ensenada
          temperature_subsurface: 15 + Math.random() * 3,
          salinity: 33.5 + Math.random() * 1.5,
          chlorophyll: 0.5 + Math.random() * 2,
          dissolved_oxygen: 4 + Math.random() * 2,
          current_speed: Math.random() * 2,
          current_direction: Math.random() * 360
        });
      }

      this.setCache(cacheKey, mockData);
      return mockData;
    } catch (error) {
      console.error('Error fetching CICESE data:', error);
      return [];
    }
  }

  // Satellite imagery from NOAA
  async getSatelliteImagery(
    bounds: { north: number; south: number; east: number; west: number },
    dataType: 'sst' | 'chlorophyll' | 'altimetry' | 'wind' | 'waves',
    startTime: string,
    endTime: string
  ): Promise<SatelliteImageData[]> {
    const cacheKey = this.getCacheKey('satellite', { bounds, dataType, startTime, endTime });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      // Simulación de datos satelitales
      const mockData: SatelliteImageData[] = [];
      const satellites = ['MODIS-Aqua', 'MODIS-Terra', 'VIIRS-SNPP', 'VIIRS-NOAA20'];
      const sensors = ['MODIS', 'VIIRS', 'AVHRR'];

      for (let i = 0; i < 5; i++) {
        mockData.push({
          satellite_name: satellites[Math.floor(Math.random() * satellites.length)],
          sensor_type: sensors[Math.floor(Math.random() * sensors.length)],
          acquisition_time: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
          bounds,
          resolution: 1000, // 1km resolution
          data_type: dataType,
          file_url: `https://example.com/satellite/${dataType}_${Date.now()}_${i}.tif`,
          thumbnail_url: `https://example.com/satellite/${dataType}_${Date.now()}_${i}_thumb.jpg`
        });
      }

      this.setCache(cacheKey, mockData);
      return mockData;
    } catch (error) {
      console.error('Error fetching satellite imagery:', error);
      return [];
    }
  }

  // AIS Vessel Traffic
  async getVesselTraffic(
    bounds: { north: number; south: number; east: number; west: number }
  ): Promise<VesselTrafficData[]> {
    const cacheKey = this.getCacheKey('vessel', { bounds });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      // Simulación de datos de tráfico marítimo
      const mockData: VesselTrafficData[] = [];
      const vesselTypes = ['Fishing', 'Cargo', 'Tanker', 'Passenger', 'Tug', 'Pleasure Craft'];
      const numVessels = 15;

      for (let i = 0; i < numVessels; i++) {
        mockData.push({
          mmsi: Math.floor(Math.random() * 1000000000),
          vessel_name: `Vessel ${i + 1}`,
          vessel_type: vesselTypes[Math.floor(Math.random() * vesselTypes.length)],
          latitude: bounds.south + Math.random() * (bounds.north - bounds.south),
          longitude: bounds.west + Math.random() * (bounds.east - bounds.west),
          course: Math.floor(Math.random() * 360),
          speed: Math.random() * 20,
          heading: Math.floor(Math.random() * 360),
          timestamp: new Date().toISOString(),
          destination: ['Ensenada', 'San Diego', 'Cabo San Lucas', 'Mazatlán'][Math.floor(Math.random() * 4)],
          status: ['Under way', 'At anchor', 'Moored'][Math.floor(Math.random() * 3)]
        });
      }

      this.setCache(cacheKey, mockData);
      return mockData;
    } catch (error) {
      console.error('Error fetching vessel traffic:', error);
      return [];
    }
  }

  // Weather alerts
  async getWeatherAlerts(
    bounds: { north: number; south: number; east: number; west: number }
  ): Promise<WeatherAlert[]> {
    const cacheKey = this.getCacheKey('weather', { bounds });
    const cached = this.getCache(cacheKey);
    if (cached) return cached;

    try {
      // Simulación de alertas meteorológicas
      const mockAlerts: WeatherAlert[] = [];
      const severities: ('low' | 'medium' | 'high' | 'critical')[] = ['low', 'medium', 'high', 'critical'];
      const alertTypes = ['Small Craft Advisory', 'Gale Warning', 'Storm Warning', 'Hazardous Seas'];

      for (let i = 0; i < 3; i++) {
        mockAlerts.push({
          id: `alert_${Date.now()}_${i}`,
          title: alertTypes[Math.floor(Math.random() * alertTypes.length)],
          description: 'Marine weather warning for the area',
          severity: severities[Math.floor(Math.random() * severities.length)],
          area: bounds,
          valid_from: new Date().toISOString(),
          valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        });
      }

      this.setCache(cacheKey, mockAlerts);
      return mockAlerts;
    } catch (error) {
      console.error('Error fetching weather alerts:', error);
      return [];
    }
  }

  // Web scraping para fuentes sin API
  async scrapeDataSources(): Promise<any[]> {
    try {
      if (!this.zai) {
        throw new Error('ZAI not initialized');
      }

      // Usar ZAI para buscar fuentes de datos oceanográficos
      const searchResult = await this.zai.functions.invoke("web_search", {
        query: "oceanographic data sources Baja California sardine migration NOAA CICESE",
        num: 10
      });

      return searchResult;
    } catch (error) {
      console.error('Error scraping data sources:', error);
      return [];
    }
  }

  // Obtener datos integrados de múltiples fuentes
  async getIntegratedOceanographicData(
    bounds: { north: number; south: number; east: number; west: number },
    startTime: string,
    endTime: string
  ): Promise<{
    noaaData: OceanographicDataPoint[];
    ciceseData: OceanographicDataPoint[];
    satelliteImages: SatelliteImageData[];
    vesselTraffic: VesselTrafficData[];
    weatherAlerts: WeatherAlert[];
  }> {
    try {
      const [noaaData, ciceseData, satelliteImages, vesselTraffic, weatherAlerts] = await Promise.all([
        this.getNOAAData(bounds, startTime, endTime, 'temperature'),
        this.getCICESEData(bounds, startTime, endTime),
        this.getSatelliteImagery(bounds, 'sst', startTime, endTime),
        this.getVesselTraffic(bounds),
        this.getWeatherAlerts(bounds)
      ]);

      return {
        noaaData,
        ciceseData,
        satelliteImages,
        vesselTraffic,
        weatherAlerts
      };
    } catch (error) {
      console.error('Error getting integrated oceanographic data:', error);
      return {
        noaaData: [],
        ciceseData: [],
        satelliteImages: [],
        vesselTraffic: [],
        weatherAlerts: []
      };
    }
  }

  // Limpiar caché
  clearCache(): void {
    this.cache.clear();
  }

  // Obtener estadísticas de caché
  getCacheStats(): { size: number; entries: Array<{ key: string; age: number }> } {
    const entries = Array.from(this.cache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }
}

// Exportar instancia única del servicio
export const externalAPIService = new ExternalAPIService();
export default ExternalAPIService;