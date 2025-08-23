/**
 * Data Export and Reporting Service for SARDIN-AI
 * Provides comprehensive data export capabilities and automated report generation
 */

import { format, subDays, startOfDay, endOfDay } from 'date-fns';

export interface ExportOptions {
  format: 'csv' | 'json' | 'xlsx' | 'pdf' | 'kml';
  dateRange: {
    start: Date;
    end: Date;
  };
  filters?: {
    dataTypes?: string[];
    locations?: Array<{ latitude: number; longitude: number; radius: number }>;
    minProbability?: number;
    maxProbability?: number;
    vesselTypes?: string[];
  };
  includeMetadata?: boolean;
  compression?: boolean;
}

export interface ReportConfig {
  type: 'summary' | 'detailed' | 'executive' | 'technical';
  title: string;
  dateRange: {
    start: Date;
    end: Date;
  };
  sections: string[];
  format: 'pdf' | 'html' | 'docx';
  includeCharts: boolean;
  includeMaps: boolean;
  customSections?: Array<{
    title: string;
    content: string;
    charts?: Array<{
      type: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap';
      data: any;
      title: string;
    }>;
  }>;
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  filename?: string;
  size?: number;
  error?: string;
  timestamp: string;
}

export interface ReportData {
  summary: {
    totalRecords: number;
    dateRange: string;
    dataTypes: string[];
    averageProbability: number;
    highProbabilityZones: number;
  };
  oceanographic: Array<{
    timestamp: string;
    location: { latitude: number; longitude: number };
    sea_surface_temp: number;
    chlorophyll: number;
    salinity: number;
    current_speed: number;
  }>;
  predictions: Array<{
    timestamp: string;
    location: { latitude: number; longitude: number };
    probability: number;
    confidence: number;
    migration_pattern?: {
      direction: string;
      speed: number;
    };
  }>;
  vessels: Array<{
    timestamp: string;
    id: string;
    name: string;
    type: string;
    location: { latitude: number; longitude: number };
    speed: number;
    heading: number;
  }>;
  alerts: Array<{
    timestamp: string;
    type: string;
    severity: string;
    message: string;
    location?: { latitude: number; longitude: number };
  }>;
}

class DataExportService {
  private exportHistory: Array<ExportResult> = [];
  private maxHistorySize = 100;

  async exportData(options: ExportOptions): Promise<ExportResult> {
    try {
      // Validate options
      this.validateExportOptions(options);
      
      // Fetch data based on options
      const data = await this.fetchDataForExport(options);
      
      // Process and format data
      const processedData = this.processDataForExport(data, options);
      
      // Generate export file
      const result = await this.generateExportFile(processedData, options);
      
      // Record export history
      this.recordExport(result);
      
      return result;
    } catch (error) {
      const errorResult: ExportResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      
      this.recordExport(errorResult);
      return errorResult;
    }
  }

  async generateReport(config: ReportConfig): Promise<ExportResult> {
    try {
      // Validate report configuration
      this.validateReportConfig(config);
      
      // Fetch data for report
      const reportData = await this.fetchDataForReport(config);
      
      // Generate report content
      const reportContent = this.generateReportContent(reportData, config);
      
      // Format report based on type
      const result = await this.generateReportFile(reportContent, config);
      
      // Record export history
      this.recordExport(result);
      
      return result;
    } catch (error) {
      const errorResult: ExportResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      };
      
      this.recordExport(errorResult);
      return errorResult;
    }
  }

  private validateExportOptions(options: ExportOptions): void {
    if (!options.format || !['csv', 'json', 'xlsx', 'pdf', 'kml'].includes(options.format)) {
      throw new Error('Invalid export format');
    }
    
    if (!options.dateRange || !options.dateRange.start || !options.dateRange.end) {
      throw new Error('Date range is required');
    }
    
    if (options.dateRange.start > options.dateRange.end) {
      throw new Error('Start date must be before end date');
    }
    
    // Validate date range is not too large (limit to 1 year)
    const oneYearAgo = subDays(new Date(), 365);
    if (options.dateRange.start < oneYearAgo) {
      throw new Error('Date range cannot exceed 1 year');
    }
  }

  private validateReportConfig(config: ReportConfig): void {
    if (!config.type || !['summary', 'detailed', 'executive', 'technical'].includes(config.type)) {
      throw new Error('Invalid report type');
    }
    
    if (!config.title || config.title.trim() === '') {
      throw new Error('Report title is required');
    }
    
    if (!config.format || !['pdf', 'html', 'docx'].includes(config.format)) {
      throw new Error('Invalid report format');
    }
    
    if (!config.sections || config.sections.length === 0) {
      throw new Error('At least one section is required');
    }
  }

  private async fetchDataForExport(options: ExportOptions): Promise<any> {
    // Simulate data fetching from database or API
    // In a real implementation, this would query your data sources
    
    const mockData = {
      oceanographic: this.generateMockOceanographicData(options.dateRange),
      predictions: this.generateMockPredictionData(options.dateRange),
      vessels: this.generateMockVesselData(options.dateRange),
      alerts: this.generateMockAlertData(options.dateRange)
    };
    
    // Apply filters
    return this.applyFilters(mockData, options.filters);
  }

  private async fetchDataForReport(config: ReportConfig): Promise<ReportData> {
    const data = await this.fetchDataForExport({
      format: 'json',
      dateRange: config.dateRange,
      filters: {}
    });
    
    return {
      summary: {
        totalRecords: Object.values(data).flat().length,
        dateRange: `${format(config.dateRange.start, 'yyyy-MM-dd')} to ${format(config.dateRange.end, 'yyyy-MM-dd')}`,
        dataTypes: Object.keys(data),
        averageProbability: this.calculateAverageProbability(data.predictions),
        highProbabilityZones: data.predictions.filter((p: any) => p.probability > 0.7).length
      },
      oceanographic: data.oceanographic,
      predictions: data.predictions,
      vessels: data.vessels,
      alerts: data.alerts
    };
  }

  private generateMockOceanographicData(dateRange: { start: Date; end: Date }): any[] {
    const data: any[] = [];
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000);
      
      for (let j = 0; j < 24; j++) { // Hourly data
        data.push({
          timestamp: new Date(date.getTime() + j * 60 * 60 * 1000).toISOString(),
          location: {
            latitude: 31.8667 + (Math.random() - 0.5) * 0.5,
            longitude: -116.6167 + (Math.random() - 0.5) * 0.5
          },
          sea_surface_temp: 16 + Math.random() * 8,
          chlorophyll: 0.3 + Math.random() * 1.2,
          salinity: 33 + Math.random() * 2,
          current_speed: Math.random() * 2,
          current_direction: Math.random() * 360
        });
      }
    }
    
    return data;
  }

  private generateMockPredictionData(dateRange: { start: Date; end: Date }): any[] {
    const data: any[] = [];
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000);
      
      data.push({
        timestamp: date.toISOString(),
        location: {
          latitude: 31.8667 + (Math.random() - 0.5) * 1,
          longitude: -116.6167 + (Math.random() - 0.5) * 1
        },
        probability: Math.random(),
        confidence: 0.6 + Math.random() * 0.4,
        migration_pattern: {
          direction: ['north', 'south', 'east', 'west'][Math.floor(Math.random() * 4)],
          speed: 0.5 + Math.random() * 2
        }
      });
    }
    
    return data;
  }

  private generateMockVesselData(dateRange: { start: Date; end: Date }): any[] {
    const data: any[] = [];
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const vesselTypes = ['fishing', 'cargo', 'passenger', 'military'];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000);
      
      for (let j = 0; j < 5; j++) { // 5 vessels per day
        data.push({
          timestamp: date.toISOString(),
          id: `vessel_${i}_${j}`,
          name: `Vessel ${i}-${j}`,
          type: vesselTypes[Math.floor(Math.random() * vesselTypes.length)],
          location: {
            latitude: 31.8667 + (Math.random() - 0.5) * 2,
            longitude: -116.6167 + (Math.random() - 0.5) * 2
          },
          speed: Math.random() * 20,
          heading: Math.random() * 360
        });
      }
    }
    
    return data;
  }

  private generateMockAlertData(dateRange: { start: Date; end: Date }): any[] {
    const data: any[] = [];
    const days = Math.ceil((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    const alertTypes = ['high_probability', 'breeding_season', 'weather_warning', 'sustainability_alert'];
    const severities = ['low', 'medium', 'high', 'critical'];
    
    for (let i = 0; i < days; i++) {
      const date = new Date(dateRange.start.getTime() + i * 24 * 60 * 60 * 1000);
      
      // Generate 1-3 alerts per day
      const alertCount = Math.floor(Math.random() * 3) + 1;
      
      for (let j = 0; j < alertCount; j++) {
        data.push({
          timestamp: new Date(date.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
          type: alertTypes[Math.floor(Math.random() * alertTypes.length)],
          severity: severities[Math.floor(Math.random() * severities.length)],
          message: `Alert ${i}-${j}: ${alertTypes[Math.floor(Math.random() * alertTypes.length)]} detected`,
          location: Math.random() > 0.3 ? {
            latitude: 31.8667 + (Math.random() - 0.5) * 0.5,
            longitude: -116.6167 + (Math.random() - 0.5) * 0.5
          } : undefined
        });
      }
    }
    
    return data;
  }

  private applyFilters(data: any, filters?: ExportOptions['filters']): any {
    if (!filters) return data;
    
    const filteredData = { ...data };
    
    // Filter by data types
    if (filters.dataTypes && filters.dataTypes.length > 0) {
      Object.keys(filteredData).forEach(key => {
        if (!filters.dataTypes!.includes(key)) {
          delete filteredData[key];
        }
      });
    }
    
    // Filter by probability range
    if (filters.minProbability !== undefined || filters.maxProbability !== undefined) {
      if (filteredData.predictions) {
        filteredData.predictions = filteredData.predictions.filter((p: any) => {
          if (filters.minProbability !== undefined && p.probability < filters.minProbability) {
            return false;
          }
          if (filters.maxProbability !== undefined && p.probability > filters.maxProbability) {
            return false;
          }
          return true;
        });
      }
    }
    
    // Filter by vessel types
    if (filters.vesselTypes && filters.vesselTypes.length > 0) {
      if (filteredData.vessels) {
        filteredData.vessels = filteredData.vessels.filter((v: any) => 
          filters.vesselTypes!.includes(v.type)
        );
      }
    }
    
    // Filter by location (simplified - would use proper distance calculation in real implementation)
    if (filters.locations && filters.locations.length > 0) {
      Object.keys(filteredData).forEach(key => {
        if (Array.isArray(filteredData[key])) {
          filteredData[key] = filteredData[key].filter((item: any) => {
            return filters.locations!.some(loc => {
              const latDiff = Math.abs(item.location.latitude - loc.latitude);
              const lonDiff = Math.abs(item.location.longitude - loc.longitude);
              return latDiff <= 0.5 && lonDiff <= 0.5; // Simplified bounding box check
            });
          });
        }
      });
    }
    
    return filteredData;
  }

  private processDataForExport(data: any, options: ExportOptions): any {
    const processed = {
      metadata: {
        exportDate: new Date().toISOString(),
        format: options.format,
        dateRange: options.dateRange,
        filters: options.filters,
        recordCount: Object.values(data).flat().length
      },
      data: data
    };
    
    if (options.includeMetadata) {
      return processed;
    } else {
      return data;
    }
  }

  private async generateExportFile(data: any, options: ExportOptions): Promise<ExportResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sardin-ai-export-${timestamp}.${options.format}`;
    
    let content: string | Blob;
    let size: number;
    
    switch (options.format) {
      case 'json':
        content = JSON.stringify(data, null, 2);
        size = new Blob([content]).size;
        break;
        
      case 'csv':
        content = this.convertToCSV(data);
        size = new Blob([content]).size;
        break;
        
      case 'xlsx':
        // In a real implementation, use a library like xlsx
        content = JSON.stringify(data); // Placeholder
        size = new Blob([content]).size;
        break;
        
      case 'pdf':
        // In a real implementation, use a library like jsPDF or pdf-lib
        content = JSON.stringify(data); // Placeholder
        size = new Blob([content]).size;
        break;
        
      case 'kml':
        content = this.convertToKML(data);
        size = new Blob([content]).size;
        break;
        
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }
    
    // In a real implementation, this would upload to cloud storage
    const downloadUrl = `data:${options.format === 'csv' ? 'text/csv' : 'application/json'};base64,${btoa(content)}`;
    
    return {
      success: true,
      downloadUrl,
      filename,
      size,
      timestamp: new Date().toISOString()
    };
  }

  private convertToCSV(data: any): string {
    const rows: string[] = [];
    
    // Process each data type
    Object.entries(data).forEach(([type, items]) => {
      if (Array.isArray(items)) {
        items.forEach(item => {
          const flattened = this.flattenObject(item);
          rows.push(Object.values(flattened).join(','));
        });
      }
    });
    
    return rows.join('\n');
  }

  private convertToKML(data: any): string {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>SARDIN-AI Export</name>
    <description>Exported data from SARDIN-AI system</description>`;
    
    // Add placemarks for each data point with location
    Object.entries(data).forEach(([type, items]) => {
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (item.location) {
            kml += `
    <Placemark>
      <name>${type}</name>
      <description>${JSON.stringify(item, null, 2)}</description>
      <Point>
        <coordinates>${item.location.longitude},${item.location.latitude},0</coordinates>
      </Point>
    </Placemark>`;
          }
        });
      }
    });
    
    kml += `
  </Document>
</kml>`;
    
    return kml;
  }

  private flattenObject(obj: any, prefix = ''): any {
    const flattened: any = {};
    
    Object.entries(obj).forEach(([key, value]) => {
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        flattened[newKey] = JSON.stringify(value);
      } else {
        flattened[newKey] = value;
      }
    });
    
    return flattened;
  }

  private generateReportContent(data: ReportData, config: ReportConfig): string {
    let content = '';
    
    // Header
    content += `# ${config.title}\n\n`;
    content += `**Report Period:** ${format(config.dateRange.start, 'MMMM d, yyyy')} - ${format(config.dateRange.end, 'MMMM d, yyyy')}\n\n`;
    content += `**Generated:** ${format(new Date(), 'MMMM d, yyyy HH:mm')}\n\n`;
    
    // Summary section
    if (config.sections.includes('summary')) {
      content += `## Executive Summary\n\n`;
      content += `This report provides a comprehensive analysis of sardine monitoring data for the specified period. Key findings include:\n\n`;
      content += `- **Total Records Analyzed:** ${data.summary.totalRecords.toLocaleString()}\n`;
      content += `- **Average Prediction Probability:** ${(data.summary.averageProbability * 100).toFixed(1)}%\n`;
      content += `- **High Probability Zones:** ${data.summary.highProbabilityZones}\n`;
      content += `- **Data Types Included:** ${data.summary.dataTypes.join(', ')}\n\n`;
    }
    
    // Oceanographic data section
    if (config.sections.includes('oceanographic') && data.oceanographic.length > 0) {
      content += `## Oceanographic Conditions\n\n`;
      const avgTemp = data.oceanographic.reduce((sum, d) => sum + d.sea_surface_temp, 0) / data.oceanographic.length;
      const avgChlorophyll = data.oceanographic.reduce((sum, d) => sum + d.chlorophyll, 0) / data.oceanographic.length;
      
      content += `### Key Metrics\n`;
      content += `- **Average Sea Surface Temperature:** ${avgTemp.toFixed(1)}°C\n`;
      content += `- **Average Chlorophyll Concentration:** ${avgChlorophyll.toFixed(2)} mg/m³\n`;
      content += `- **Data Points:** ${data.oceanographic.length.toLocaleString()}\n\n`;
    }
    
    // Predictions section
    if (config.sections.includes('predictions') && data.predictions.length > 0) {
      content += `## Sardine Predictions\n\n`;
      const highProbCount = data.predictions.filter(p => p.probability > 0.7).length;
      const avgConfidence = data.predictions.reduce((sum, d) => sum + d.confidence, 0) / data.predictions.length;
      
      content += `### Prediction Analysis\n`;
      content += `- **High Probability Detections:** ${highProbCount}\n`;
      content += `- **Average Confidence:** ${(avgConfidence * 100).toFixed(1)}%\n`;
      content += `- **Total Predictions:** ${data.predictions.length.toLocaleString()}\n\n`;
    }
    
    // Vessel traffic section
    if (config.sections.includes('vessels') && data.vessels.length > 0) {
      content += `## Vessel Traffic\n\n`;
      const vesselTypes = data.vessels.reduce((acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      content += `### Vessel Distribution\n`;
      Object.entries(vesselTypes).forEach(([type, count]) => {
        content += `- **${type}:** ${count} vessels\n`;
      });
      content += `\n`;
    }
    
    // Alerts section
    if (config.sections.includes('alerts') && data.alerts.length > 0) {
      content += `## Alerts and Notifications\n\n`;
      const alertTypes = data.alerts.reduce((acc, a) => {
        acc[a.type] = (acc[a.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      content += `### Alert Summary\n`;
      Object.entries(alertTypes).forEach(([type, count]) => {
        content += `- **${type}:** ${count} alerts\n`;
      });
      content += `\n`;
    }
    
    // Custom sections
    if (config.customSections) {
      config.customSections.forEach(section => {
        content += `## ${section.title}\n\n`;
        content += `${section.content}\n\n`;
      });
    }
    
    return content;
  }

  private async generateReportFile(content: string, config: ReportConfig): Promise<ExportResult> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `sardin-ai-report-${timestamp}.${config.format}`;
    
    let fileContent: string | Blob;
    let size: number;
    
    switch (config.format) {
      case 'html':
        fileContent = this.convertToHTML(content, config);
        size = new Blob([fileContent]).size;
        break;
        
      case 'pdf':
        // In a real implementation, use a PDF generation library
        fileContent = content; // Placeholder
        size = new Blob([fileContent]).size;
        break;
        
      case 'docx':
        // In a real implementation, use a DOCX generation library
        fileContent = content; // Placeholder
        size = new Blob([fileContent]).size;
        break;
        
      default:
        throw new Error(`Unsupported report format: ${config.format}`);
    }
    
    const downloadUrl = `data:text/${config.format === 'html' ? 'html' : 'plain'};base64,${btoa(fileContent)}`;
    
    return {
      success: true,
      downloadUrl,
      filename,
      size,
      timestamp: new Date().toISOString()
    };
  }

  private convertToHTML(content: string, config: ReportConfig): string {
    // Convert markdown to HTML (simplified)
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.title}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; }
        h1, h2, h3 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
    </style>
</head>
<body>`;
    
    // Simple markdown to HTML conversion
    html += content
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/^- (.*$)/gm, '<li>$1</li>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/^(?!<[h|l])/gm, '<p>')
      .replace(/<p><h/g, '<h')
      .replace(/<\/p>/g, '');
    
    html += `
</body>
</html>`;
    
    return html;
  }

  private calculateAverageProbability(predictions: any[]): number {
    if (predictions.length === 0) return 0;
    const sum = predictions.reduce((acc, p) => acc + p.probability, 0);
    return sum / predictions.length;
  }

  private recordExport(result: ExportResult): void {
    this.exportHistory.push(result);
    
    // Keep only recent exports
    if (this.exportHistory.length > this.maxHistorySize) {
      this.exportHistory = this.exportHistory.slice(-this.maxHistorySize);
    }
  }

  // Public methods for accessing export history
  getExportHistory(limit: number = 10): ExportResult[] {
    return this.exportHistory.slice(-limit);
  }

  getExportStats(): {
    totalExports: number;
    successfulExports: number;
    failedExports: number;
    averageFileSize: number;
    popularFormats: Record<string, number>;
  } {
    const total = this.exportHistory.length;
    const successful = this.exportHistory.filter(e => e.success).length;
    const failed = total - successful;
    
    const sizes = this.exportHistory.filter(e => e.size).map(e => e.size!);
    const averageSize = sizes.length > 0 ? sizes.reduce((a, b) => a + b, 0) / sizes.length : 0;
    
    const formats = this.exportHistory.reduce((acc, exportItem) => {
      const format = exportItem.filename?.split('.').pop() || 'unknown';
      acc[format] = (acc[format] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalExports: total,
      successfulExports: successful,
      failedExports: failed,
      averageFileSize: averageSize,
      popularFormats: formats
    };
  }

  // Predefined export configurations
  getPredefinedConfigs(): Array<{
    name: string;
    description: string;
    options: ExportOptions;
  }> {
    return [
      {
        name: 'Daily Summary',
        description: 'Export all data from the last 24 hours',
        options: {
          format: 'csv',
          dateRange: {
            start: subDays(new Date(), 1),
            end: new Date()
          },
          includeMetadata: true
        }
      },
      {
        name: 'Weekly Analysis',
        description: 'Export data for the last week in JSON format',
        options: {
          format: 'json',
          dateRange: {
            start: subDays(new Date(), 7),
            end: new Date()
          },
          includeMetadata: true
        }
      },
      {
        name: 'Monthly Report',
        description: 'Generate comprehensive monthly report',
        options: {
          format: 'pdf',
          dateRange: {
            start: subDays(new Date(), 30),
            end: new Date()
          },
          includeMetadata: true
        }
      },
      {
        name: 'High Probability Zones',
        description: 'Export only high probability prediction zones',
        options: {
          format: 'kml',
          dateRange: {
            start: subDays(new Date(), 7),
            end: new Date()
          },
          filters: {
            minProbability: 0.7
          },
          includeMetadata: false
        }
      }
    ];
  }

  // Predefined report configurations
  getPredefinedReports(): Array<{
    name: string;
    description: string;
    config: ReportConfig;
  }> {
    return [
      {
        name: 'Executive Summary',
        description: 'High-level overview for stakeholders',
        config: {
          type: 'executive',
          title: 'SARDIN-AI Executive Summary Report',
          dateRange: {
            start: subDays(new Date(), 30),
            end: new Date()
          },
          sections: ['summary', 'predictions', 'alerts'],
          format: 'pdf',
          includeCharts: true,
          includeMaps: true
        }
      },
      {
        name: 'Technical Analysis',
        description: 'Detailed technical analysis for researchers',
        config: {
          type: 'technical',
          title: 'SARDIN-AI Technical Analysis Report',
          dateRange: {
            start: subDays(new Date(), 30),
            end: new Date()
          },
          sections: ['summary', 'oceanographic', 'predictions', 'vessels', 'alerts'],
          format: 'html',
          includeCharts: true,
          includeMaps: true
        }
      },
      {
        name: 'Fishing Operations Report',
        description: 'Report focused on fishing operations and vessel activity',
        config: {
          type: 'detailed',
          title: 'Fishing Operations Report',
          dateRange: {
            start: subDays(new Date(), 7),
            end: new Date()
          },
          sections: ['summary', 'predictions', 'vessels'],
          format: 'pdf',
          includeCharts: true,
          includeMaps: true
        }
      }
    ];
  }
}

// Global export service instance
export const dataExportService = new DataExportService();