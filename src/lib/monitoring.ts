/**
 * Comprehensive Logging and Monitoring System for SARDIN-AI
 * Provides structured logging, performance monitoring, error tracking, and system health checks
 */

import { performance } from 'perf_hooks';
import { useEffect } from 'react';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  component: string;
  message: string;
  metadata?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface MetricData {
  name: string;
  value: number;
  timestamp: string;
  tags: Record<string, string>;
}

export interface HealthCheck {
  component: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  metrics?: Record<string, number>;
  lastCheck: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: number;
  timestamp: string;
}

class MonitoringService {
  private logs: LogEntry[] = [];
  private metrics: MetricData[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private performanceMetrics: PerformanceMetrics[] = [];
  private maxLogEntries = 10000;
  private maxMetricEntries = 50000;
  private flushInterval: NodeJS.Timeout | null = null;
  private isProduction = process.env.NODE_ENV === 'production';

  constructor() {
    this.startPeriodicFlush();
    this.setupErrorHandlers();
    this.startPerformanceMonitoring();
  }

  private setupErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.error('Uncaught Exception', { error: error.message, stack: error.stack });
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.error('Unhandled Promise Rejection', { 
        reason: reason instanceof Error ? reason.message : reason,
        stack: reason instanceof Error ? reason.stack : undefined
      });
    });
  }

  private startPeriodicFlush() {
    this.flushInterval = setInterval(() => {
      this.flushLogs();
      this.flushMetrics();
    }, 30000); // Flush every 30 seconds
  }

  private startPerformanceMonitoring() {
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      const metrics: PerformanceMetrics = {
        responseTime: 0, // Will be calculated per request
        memoryUsage: memUsage,
        cpuUsage: cpuUsage.user / 1000000, // Convert to seconds
        timestamp: new Date().toISOString()
      };

      this.performanceMetrics.push(metrics);
      
      // Keep only last 1000 entries
      if (this.performanceMetrics.length > 1000) {
        this.performanceMetrics = this.performanceMetrics.slice(-1000);
      }

      // Record memory and CPU as metrics
      this.recordMetric('memory_usage', memUsage.heapUsed / 1024 / 1024, { unit: 'MB' });
      this.recordMetric('cpu_usage', cpuUsage.user / 1000000, { unit: 'seconds' });
    }, 5000); // Every 5 seconds
  }

  // Logging methods
  debug(message: string, metadata?: Record<string, any>, component = 'system') {
    this.log('debug', message, component, metadata);
  }

  info(message: string, metadata?: Record<string, any>, component = 'system') {
    this.log('info', message, component, metadata);
  }

  warn(message: string, metadata?: Record<string, any>, component = 'system') {
    this.log('warn', message, component, metadata);
  }

  error(message: string, metadata?: Record<string, any>, component = 'system') {
    this.log('error', message, component, metadata);
    
    // In production, send errors to external monitoring service
    if (this.isProduction) {
      this.sendErrorToExternalService(message, metadata, component);
    }
  }

  private log(level: LogEntry['level'], message: string, component: string, metadata?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      metadata,
      // Add context if available
      sessionId: this.getCurrentSessionId(),
      requestId: this.getCurrentRequestId()
    };

    this.logs.push(entry);

    // Keep only recent logs
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }

    // Console output for development
    if (!this.isProduction || level === 'error') {
      this.logToConsole(entry);
    }
  }

  private logToConsole(entry: LogEntry) {
    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.component}]`;
    
    const message = entry.metadata 
      ? `${prefix} ${entry.message} ${JSON.stringify(entry.metadata)}`
      : `${prefix} ${entry.message}`;

    switch (entry.level) {
      case 'debug':
        console.debug(message);
        break;
      case 'info':
        console.info(message);
        break;
      case 'warn':
        console.warn(message);
        break;
      case 'error':
        console.error(message);
        break;
    }
  }

  // Metrics recording
  recordMetric(name: string, value: number, tags: Record<string, string> = {}) {
    const metric: MetricData = {
      name,
      value,
      timestamp: new Date().toISOString(),
      tags
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricEntries) {
      this.metrics = this.metrics.slice(-this.maxMetricEntries);
    }
  }

  // Performance monitoring
  startTimer(label: string): () => void {
    const start = performance.now();
    
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(`timer_${label}`, duration, { unit: 'ms' });
    };
  }

  // Health checks
  async registerHealthCheck(
    component: string, 
    checkFn: () => Promise<{ healthy: boolean; message?: string; metrics?: Record<string, number> }>
  ) {
    try {
      const result = await checkFn();
      const healthCheck: HealthCheck = {
        component,
        status: result.healthy ? 'healthy' : result.healthy === false ? 'unhealthy' : 'degraded',
        message: result.message,
        metrics: result.metrics,
        lastCheck: new Date().toISOString()
      };

      this.healthChecks.set(component, healthCheck);
    } catch (error) {
      this.healthChecks.set(component, {
        component,
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      });
    }
  }

  getHealthStatus(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  getSystemHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = this.getHealthStatus();
    
    if (checks.every(check => check.status === 'healthy')) {
      return 'healthy';
    } else if (checks.some(check => check.status === 'unhealthy')) {
      return 'unhealthy';
    } else {
      return 'degraded';
    }
  }

  // Data retrieval
  getLogs(filter?: {
    level?: LogEntry['level'];
    component?: string;
    startTime?: string;
    endTime?: string;
    limit?: number;
  }): LogEntry[] {
    let filteredLogs = [...this.logs];

    if (filter) {
      if (filter.level) {
        filteredLogs = filteredLogs.filter(log => log.level === filter.level);
      }
      if (filter.component) {
        filteredLogs = filteredLogs.filter(log => log.component === filter.component);
      }
      if (filter.startTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredLogs = filteredLogs.filter(log => log.timestamp <= filter.endTime!);
      }
      if (filter.limit) {
        filteredLogs = filteredLogs.slice(-filter.limit);
      }
    }

    return filteredLogs;
  }

  getMetrics(filter?: {
    name?: string;
    startTime?: string;
    endTime?: string;
    tags?: Record<string, string>;
  }): MetricData[] {
    let filteredMetrics = [...this.metrics];

    if (filter) {
      if (filter.name) {
        filteredMetrics = filteredMetrics.filter(metric => metric.name === filter.name);
      }
      if (filter.startTime) {
        filteredMetrics = filteredMetrics.filter(metric => metric.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filteredMetrics = filteredMetrics.filter(metric => metric.timestamp <= filter.endTime!);
      }
      if (filter.tags) {
        filteredMetrics = filteredMetrics.filter(metric => 
          Object.entries(filter.tags!).every(([key, value]) => 
            metric.tags[key] === value
          )
        );
      }
    }

    return filteredMetrics;
  }

  getPerformanceMetrics(): PerformanceMetrics[] {
    return [...this.performanceMetrics];
  }

  // Data export
  exportLogs(format: 'json' | 'csv' = 'json'): string {
    const logs = this.getLogs();
    
    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'level', 'component', 'message', 'metadata'];
      const rows = logs.map(log => [
        log.timestamp,
        log.level,
        log.component,
        log.message.replace(/"/g, '""'), // Escape quotes
        log.metadata ? JSON.stringify(log.metadata).replace(/"/g, '""') : ''
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    }
  }

  exportMetrics(format: 'json' | 'csv' = 'json'): string {
    const metrics = this.getMetrics();
    
    if (format === 'json') {
      return JSON.stringify(metrics, null, 2);
    } else {
      // CSV format
      const headers = ['timestamp', 'name', 'value', 'tags'];
      const rows = metrics.map(metric => [
        metric.timestamp,
        metric.name,
        metric.value.toString(),
        JSON.stringify(metric.tags).replace(/"/g, '""')
      ]);
      
      return [headers, ...rows]
        .map(row => row.map(cell => `"${cell}"`).join(','))
        .join('\n');
    }
  }

  // Flush data to external storage
  private async flushLogs() {
    if (this.logs.length === 0) return;

    try {
      // In production, send to external logging service
      if (this.isProduction) {
        await this.sendLogsToExternalService(this.logs);
      }
      
      // Clear flushed logs
      this.logs = [];
    } catch (error) {
      console.error('Error flushing logs:', error);
    }
  }

  private async flushMetrics() {
    if (this.metrics.length === 0) return;

    try {
      // In production, send to external monitoring service
      if (this.isProduction) {
        await this.sendMetricsToExternalService(this.metrics);
      }
      
      // Clear flushed metrics
      this.metrics = [];
    } catch (error) {
      console.error('Error flushing metrics:', error);
    }
  }

  // External service integration (placeholders)
  private async sendLogsToExternalService(logs: LogEntry[]) {
    // Integration with external logging services like Datadog, Loggly, etc.
    // This is a placeholder implementation
    this.debug('Sending logs to external service', { count: logs.length });
  }

  private async sendMetricsToExternalService(metrics: MetricData[]) {
    // Integration with external monitoring services like Prometheus, Datadog, etc.
    // This is a placeholder implementation
    this.debug('Sending metrics to external service', { count: metrics.length });
  }

  private async sendErrorToExternalService(message: string, metadata?: Record<string, any>, component?: string) {
    // Integration with error tracking services like Sentry, Bugsnag, etc.
    // This is a placeholder implementation
    this.debug('Sending error to external service', { message, component, metadata });
  }

  // Context management
  private getCurrentSessionId(): string | undefined {
    // Return current session ID if available
    return (global as any).currentSessionId;
  }

  private getCurrentRequestId(): string | undefined {
    // Return current request ID if available
    return (global as any).currentRequestId;
  }

  // Cleanup
  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    // Flush remaining data
    this.flushLogs();
    this.flushMetrics();
  }
}

// Global monitoring service instance
export const monitoringService = new MonitoringService();

// Express middleware for request monitoring
export function requestMonitoring(req: any, res: any, next: any) {
  const startTime = performance.now();
  const requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Set request ID in global context
  (global as any).currentRequestId = requestId;
  
  // Add request ID to response headers
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  monitoringService.info('Request started', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId
  }, 'http');

  // Override res.end to log request completion
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = performance.now() - startTime;
    
    monitoringService.info('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: Math.round(duration),
      requestId
    }, 'http');

    // Record response time metric
    monitoringService.recordMetric('http_response_time', duration, {
      method: req.method,
      statusCode: res.statusCode.toString()
    });

    originalEnd.call(this, chunk, encoding);
  };

  next();
}

// React hook for performance monitoring
export function usePerformanceMonitoring(componentName: string) {
  useEffect(() => {
    const startTime = performance.now();
    
    return () => {
      const duration = performance.now() - startTime;
      monitoringService.recordMetric(`component_render_time_${componentName}`, duration, {
        component: componentName
      });
    };
  }, [componentName]);
}

// Utility function for monitoring async operations
export async function monitorAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  metadata?: Record<string, any>
): Promise<T> {
  const timer = monitoringService.startTimer(operation);
  
  try {
    monitoringService.debug(`Starting ${operation}`, metadata);
    const result = await fn();
    monitoringService.info(`Completed ${operation}`, { ...metadata, success: true });
    return result;
  } catch (error) {
    monitoringService.error(`Failed ${operation}`, {
      ...metadata,
      error: error instanceof Error ? error.message : 'Unknown error',
      success: false
    });
    throw error;
  } finally {
    timer();
  }
}

// Health check utilities
export function createHealthCheck(
  component: string,
  checkFn: () => Promise<{ healthy: boolean; message?: string; metrics?: Record<string, number> }>
) {
  return {
    register: () => monitoringService.registerHealthCheck(component, checkFn),
    component
  };
}

// Example health checks
export const databaseHealthCheck = createHealthCheck('database', async () => {
  // Check database connectivity
  try {
    // Replace with actual database health check
    await new Promise(resolve => setTimeout(resolve, 100));
    return { healthy: true, message: 'Database connection healthy' };
  } catch (error) {
    return { 
      healthy: false, 
      message: error instanceof Error ? error.message : 'Database connection failed' 
    };
  }
});

export const externalApiHealthCheck = createHealthCheck('external_apis', async () => {
  // Check external API connectivity
  try {
    // Replace with actual API health check
    await new Promise(resolve => setTimeout(resolve, 200));
    return { healthy: true, message: 'External APIs accessible' };
  } catch (error) {
    return { 
      healthy: false, 
      message: error instanceof Error ? error.message : 'External APIs unreachable' 
    };
  }
});

export const systemHealthCheck = createHealthCheck('system', async () => {
  // Check system resources
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
  const memoryUsagePercent = (heapUsedMB / heapTotalMB) * 100;
  
  return {
    healthy: memoryUsagePercent < 90,
    message: `Memory usage: ${memoryUsagePercent.toFixed(1)}%`,
    metrics: {
      memory_usage_percent: memoryUsagePercent,
      heap_used_mb: heapUsedMB,
      heap_total_mb: heapTotalMB
    }
  };
});