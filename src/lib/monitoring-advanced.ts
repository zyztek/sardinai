// Sistema de monitoreo avanzado para SARDIN-AI
// Incluye métricas, logging, alertas y dashboard de monitoreo

import { performance } from 'perf_hooks';
import { db } from './db';

export interface MetricData {
  name: string;
  value: number;
  type: 'gauge' | 'counter' | 'histogram';
  tags?: Record<string, string>;
  timestamp?: number;
}

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  component?: string;
  userId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp?: number;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details?: Record<string, any>;
  timestamp?: number;
}

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne';
  threshold: number;
  duration: number; // segundos
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  notificationChannels: string[];
}

class MonitoringService {
  private metrics: Map<string, MetricData> = new Map();
  private logs: LogEntry[] = [];
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alertRules: AlertRule[] = [];
  private metricHistory: Map<string, MetricData[]> = new Map();
  private isInitialized = false;
  private startTime = performance.now();

  constructor() {
    this.initializeDefaultAlertRules();
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Cargar reglas de alerta desde la base de datos
      await this.loadAlertRulesFromDB();
      
      // Iniciar recolección de métricas del sistema
      this.startSystemMetricsCollection();
      
      // Iniciar limpieza periódica
      this.startCleanupTasks();
      
      this.isInitialized = true;
      this.log('info', 'Monitoring service initialized', 'monitoring');
    } catch (error) {
      this.log('error', 'Failed to initialize monitoring service', 'monitoring', { error });
    }
  }

  // Registro de métricas
  recordMetric(metric: MetricData): void {
    const timestamp = Date.now();
    const metricData: MetricData = {
      ...metric,
      timestamp
    };

    // Almacenar métrica actual
    this.metrics.set(metric.name, metricData);

    // Almacenar en historial
    if (!this.metricHistory.has(metric.name)) {
      this.metricHistory.set(metric.name, []);
    }
    
    const history = this.metricHistory.get(metric.name)!;
    history.push(metricData);
    
    // Mantener solo las últimas 1000 entradas
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }

    // Guardar en base de datos
    this.saveMetricToDB(metricData);

    // Verificar reglas de alerta
    this.checkAlertRules(metricData);
  }

  // Incrementar contador
  incrementCounter(name: string, value: number = 1, tags?: Record<string, string>): void {
    const current = this.metrics.get(name);
    const currentValue = current?.type === 'counter' ? current.value : 0;
    
    this.recordMetric({
      name,
      value: currentValue + value,
      type: 'counter',
      tags
    });
  }

  // Registrar gauge
  setGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: 'gauge',
      tags
    });
  }

  // Registrar histogram
  recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: 'histogram',
      tags
    });
  }

  // Logging estructurado
  log(level: LogEntry['level'], message: string, component?: string, metadata?: Record<string, any>): void {
    const logEntry: LogEntry = {
      level,
      message,
      component,
      timestamp: Date.now(),
      metadata
    };

    // Almacenar en memoria
    this.logs.push(logEntry);
    
    // Mantener solo las últimas 1000 entradas
    if (this.logs.length > 1000) {
      this.logs.splice(0, this.logs.length - 1000);
    }

    // Guardar en base de datos
    this.saveLogToDB(logEntry);

    // Enviar a consola en desarrollo
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[${level.toUpperCase()}] ${component ? `[${component}]` : ''}: ${message}`, metadata || '');
    }
  }

  // Health check
  async recordHealthCheck(name: string, checkFunction: () => Promise<boolean> | boolean): Promise<void> {
    const startTime = performance.now();
    
    try {
      const result = await checkFunction();
      const responseTime = performance.now() - startTime;
      
      const healthCheck: HealthCheck = {
        name,
        status: result ? 'healthy' : 'unhealthy',
        responseTime,
        timestamp: Date.now()
      };

      this.healthChecks.set(name, healthCheck);
      this.saveHealthCheckToDB(healthCheck);

      if (!result) {
        this.log('warn', `Health check failed: ${name}`, 'monitoring', { responseTime });
      }
    } catch (error) {
      const responseTime = performance.now() - startTime;
      const healthCheck: HealthCheck = {
        name,
        status: 'unhealthy',
        responseTime,
        timestamp: Date.now(),
        details: { error: error instanceof Error ? error.message : String(error) }
      };

      this.healthChecks.set(name, healthCheck);
      this.saveHealthCheckToDB(healthCheck);
      
      this.log('error', `Health check error: ${name}`, 'monitoring', { error, responseTime });
    }
  }

  // Obtener métricas actuales
  getCurrentMetrics(): MetricData[] {
    return Array.from(this.metrics.values());
  }

  // Obtener historial de métricas
  getMetricHistory(name: string, limit: number = 100): MetricData[] {
    const history = this.metricHistory.get(name) || [];
    return history.slice(-limit);
  }

  // Obtener logs recientes
  getRecentLogs(level?: LogEntry['level'], limit: number = 100): LogEntry[] {
    let filteredLogs = this.logs;
    
    if (level) {
      filteredLogs = filteredLogs.filter(log => log.level === level);
    }
    
    return filteredLogs.slice(-limit);
  }

  // Obtener health checks
  getHealthChecks(): HealthCheck[] {
    return Array.from(this.healthChecks.values());
  }

  // Obtener estado del sistema
  getSystemStatus(): {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: number;
    healthChecks: HealthCheck[];
    recentErrors: LogEntry[];
    activeAlerts: AlertRule[];
  } {
    const memUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    
    return {
      uptime,
      memoryUsage: memUsage,
      cpuUsage: process.cpuUsage().user,
      healthChecks: this.getHealthChecks(),
      recentErrors: this.getRecentLogs('error', 10),
      activeAlerts: this.alertRules.filter(rule => rule.enabled)
    };
  }

  // Crear regla de alerta
  createAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const alertRule: AlertRule = {
      ...rule,
      id
    };
    
    this.alertRules.push(alertRule);
    this.saveAlertRuleToDB(alertRule);
    
    this.log('info', `Alert rule created: ${rule.name}`, 'monitoring', { rule });
    
    return id;
  }

  // Eliminar regla de alerta
  deleteAlertRule(id: string): boolean {
    const index = this.alertRules.findIndex(rule => rule.id === id);
    if (index === -1) return false;
    
    const rule = this.alertRules[index];
    this.alertRules.splice(index, 1);
    
    this.log('info', `Alert rule deleted: ${rule.name}`, 'monitoring', { rule });
    
    return true;
  }

  // Métodos privados
  private async saveMetricToDB(metric: MetricData): Promise<void> {
    try {
      await db.systemMetrics.create({
        data: {
          metric_name: metric.name,
          metric_value: metric.value,
          metric_type: metric.type,
          tags: metric.tags || {},
          timestamp: new Date(metric.timestamp || Date.now())
        }
      });
    } catch (error) {
      console.error('Error saving metric to DB:', error);
    }
  }

  private async saveLogToDB(log: LogEntry): Promise<void> {
    try {
      await db.systemLog.create({
        data: {
          level: log.level,
          message: log.message,
          component: log.component,
          user_id: log.userId,
          request_id: log.requestId,
          ip_address: log.ipAddress,
          user_agent: log.userAgent,
          metadata: log.metadata || {},
          created_at: new Date(log.timestamp || Date.now())
        }
      });
    } catch (error) {
      console.error('Error saving log to DB:', error);
    }
  }

  private async saveHealthCheckToDB(healthCheck: HealthCheck): Promise<void> {
    try {
      await db.systemMetrics.create({
        data: {
          metric_name: `health_check_${healthCheck.name}`,
          metric_value: healthCheck.status === 'healthy' ? 1 : 0,
          metric_type: 'gauge',
          tags: {
            status: healthCheck.status,
            response_time: healthCheck.responseTime.toString()
          },
          timestamp: new Date(healthCheck.timestamp || Date.now())
        }
      });
    } catch (error) {
      console.error('Error saving health check to DB:', error);
    }
  }

  private async saveAlertRuleToDB(rule: AlertRule): Promise<void> {
    try {
      await db.systemConfig.upsert({
        where: { config_key: `alert_rule_${rule.id}` },
        update: {
          config_value: rule,
          updated_at: new Date()
        },
        create: {
          config_key: `alert_rule_${rule.id}`,
          config_value: rule,
          description: `Alert rule: ${rule.name}`,
          created_at: new Date()
        }
      });
    } catch (error) {
      console.error('Error saving alert rule to DB:', error);
    }
  }

  private async loadAlertRulesFromDB(): Promise<void> {
    try {
      const configs = await db.systemConfig.findMany({
        where: {
          config_key: {
            startsWith: 'alert_rule_'
          }
        }
      });

      this.alertRules = configs
        .filter(config => config.config_value?.id)
        .map(config => config.config_value as AlertRule);
    } catch (error) {
      console.error('Error loading alert rules from DB:', error);
    }
  }

  private checkAlertRules(metric: MetricData): void {
    for (const rule of this.alertRules) {
      if (!rule.enabled || rule.metric !== metric.name) continue;

      const conditionMet = this.evaluateCondition(metric.value, rule.condition, rule.threshold);
      
      if (conditionMet) {
        this.triggerAlert(rule, metric);
      }
    }
  }

  private evaluateCondition(value: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return value > threshold;
      case 'lt': return value < threshold;
      case 'eq': return value === threshold;
      case 'ne': return value !== threshold;
      default: return false;
    }
  }

  private triggerAlert(rule: AlertRule, metric: MetricData): void {
    const alertMessage = `Alert triggered: ${rule.name} - ${rule.metric} ${rule.condition} ${rule.threshold} (current: ${metric.value})`;
    
    this.log('warn', alertMessage, 'monitoring', { rule, metric });

    // Aquí se podrían enviar notificaciones por email, Slack, etc.
    // this.sendNotification(rule, alertMessage);
  }

  private initializeDefaultAlertRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Memory Usage',
        metric: 'memory_usage',
        condition: 'gt',
        threshold: 90,
        duration: 300,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        name: 'High CPU Usage',
        metric: 'cpu_usage',
        condition: 'gt',
        threshold: 80,
        duration: 300,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        name: 'High Response Time',
        metric: 'api_response_time',
        condition: 'gt',
        threshold: 5000,
        duration: 60,
        severity: 'medium',
        enabled: true,
        notificationChannels: ['email']
      },
      {
        name: 'Error Rate High',
        metric: 'error_rate',
        condition: 'gt',
        threshold: 5,
        duration: 300,
        severity: 'high',
        enabled: true,
        notificationChannels: ['email', 'slack']
      }
    ];

    defaultRules.forEach(rule => {
      this.createAlertRule(rule);
    });
  }

  private startSystemMetricsCollection(): void {
    // Recolección de métricas del sistema cada 30 segundos
    setInterval(() => {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      this.setGauge('memory_usage', (memUsage.heapUsed / memUsage.heapTotal) * 100);
      this.setGauge('cpu_usage', cpuUsage.user);
      this.setGauge('uptime', Date.now() - this.startTime);
    }, 30000);
  }

  private startCleanupTasks(): void {
    // Limpiar métricas antiguas cada hora
    setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      
      for (const [name, history] of this.metricHistory.entries()) {
        const filtered = history.filter(metric => 
          (metric.timestamp || 0) > oneHourAgo
        );
        this.metricHistory.set(name, filtered);
      }
    }, 60 * 60 * 1000);

    // Limpiar logs antiguos cada hora
    setInterval(() => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      this.logs = this.logs.filter(log => 
        (log.timestamp || 0) > oneHourAgo
      );
    }, 60 * 60 * 1000);
  }

  // Middleware para Express
  middleware() {
    return (req: any, res: any, next: any) => {
      const startTime = performance.now();
      
      // Generar ID de solicitud
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.requestId = requestId;
      
      // Log de solicitud
      this.log('info', `${req.method} ${req.path}`, 'http', {
        requestId,
        method: req.method,
        path: req.path,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Sobrescribir método end para registrar respuesta
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        const responseTime = performance.now() - startTime;
        
        // Registrar métricas
        monitoringService.recordHistogram('api_response_time', responseTime, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode.toString()
        });
        
        // Incrementar contador de solicitudes
        monitoringService.incrementCounter('api_requests_total', 1, {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode.toString()
        });
        
        // Registrar errores
        if (res.statusCode >= 400) {
          monitoringService.incrementCounter('api_errors_total', 1, {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode.toString()
          });
          
          monitoringService.log('warn', `HTTP ${res.statusCode} ${req.method} ${req.path}`, 'http', {
            requestId,
            statusCode: res.statusCode,
            responseTime
          });
        }
        
        // Llamar al método original
        originalEnd.call(this, chunk, encoding);
      };
      
      next();
    };
  }

  // Health check endpoint
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: number;
    uptime: number;
    checks: HealthCheck[];
    metrics: MetricData[];
  }> {
    const checks = this.getHealthChecks();
    const failedChecks = checks.filter(check => check.status === 'unhealthy');
    
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failedChecks.length > 0) {
      status = failedChecks.length === checks.length ? 'unhealthy' : 'degraded';
    }
    
    return {
      status,
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      checks,
      metrics: this.getCurrentMetrics()
    };
  }
}

// Exportar instancia única del servicio
export const monitoringService = new MonitoringService();
export default MonitoringService;