-- Script completo para la configuración de la base de datos de SARDIN-AI
-- Este script crea todas las tablas, relaciones, funciones y triggers necesarios

-- Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Esquema principal
CREATE SCHEMA IF NOT EXISTS sardin_ai;
SET search_path TO sardin_ai, public;

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'researcher', 'fisher', 'user')),
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}'
);

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET,
    user_agent TEXT,
    is_active BOOLEAN DEFAULT true
);

-- Tabla de dispositivos de usuarios
CREATE TABLE IF NOT EXISTS user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_type VARCHAR(50) NOT NULL,
    device_name VARCHAR(100),
    device_id VARCHAR(100) NOT NULL,
    push_token TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de zonas oceánicas
CREATE TABLE IF NOT EXISTS ocean_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    geometry GEOMETRY(POLYGON, 4326) NOT NULL,
    zone_type VARCHAR(50) NOT NULL CHECK (zone_type IN ('fishing', 'protected', 'breeding', 'migration', 'research')),
    depth_min DECIMAL(10,2),
    depth_max DECIMAL(10,2),
    temperature_min DECIMAL(5,2),
    temperature_max DECIMAL(5,2),
    salinity_min DECIMAL(5,2),
    salinity_max DECIMAL(5,2),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Tabla de datos oceanográficos
CREATE TABLE IF NOT EXISTS oceanographic_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    zone_id UUID REFERENCES ocean_zones(id) ON DELETE SET NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    data_source VARCHAR(50) NOT NULL CHECK (data_source IN ('noaa', 'cicese', 'satellite', 'buoy', 'user_report')),
    temperature_surface DECIMAL(5,2),
    temperature_subsurface DECIMAL(5,2),
    salinity DECIMAL(5,2),
    chlorophyll DECIMAL(8,6),
    dissolved_oxygen DECIMAL(6,4),
    ph DECIMAL(4,2),
    turbidity DECIMAL(6,4),
    current_speed DECIMAL(5,2),
    current_direction INTEGER, -- grados
    wave_height DECIMAL(4,2),
    wave_period DECIMAL(4,1),
    wave_direction INTEGER,
    wind_speed DECIMAL(5,2),
    wind_direction INTEGER,
    atmospheric_pressure DECIMAL(6,2),
    precipitation DECIMAL(5,2),
    visibility DECIMAL(5,2),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para datos oceanográficos
CREATE INDEX IF NOT EXISTS idx_oceanographic_data_location ON oceanographic_data USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_oceanographic_data_timestamp ON oceanographic_data (timestamp);
CREATE INDEX IF NOT EXISTS idx_oceanographic_data_zone ON oceanographic_data (zone_id);
CREATE INDEX IF NOT EXISTS idx_oceanographic_data_source ON oceanographic_data (data_source);
CREATE INDEX IF NOT EXISTS idx_oceanographic_data_temp_surface ON oceanographic_data (temperature_surface) WHERE temperature_surface IS NOT NULL;

-- Tabla de predicciones de cardúmenes
CREATE TABLE IF NOT EXISTS sardine_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    zone_id UUID REFERENCES ocean_zones(id) ON DELETE SET NULL,
    prediction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    prediction_model VARCHAR(50) NOT NULL,
    probability DECIMAL(5,4) NOT NULL CHECK (probability >= 0 AND probability <= 1),
    confidence_lower DECIMAL(5,4),
    confidence_upper DECIMAL(5,4),
    estimated_density DECIMAL(10,2), -- toneladas por km²
    estimated_depth_min DECIMAL(10,2),
    estimated_depth_max DECIMAL(10,2),
    school_size VARCHAR(20) CHECK (school_size IN ('small', 'medium', 'large', 'very_large')),
    migration_direction VARCHAR(20),
    factors JSONB DEFAULT '{}', -- factores que influyeron en la predicción
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Índices para predicciones
CREATE INDEX IF NOT EXISTS idx_sardine_predictions_location ON sardine_predictions USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_sardine_predictions_date ON sardine_predictions (prediction_date);
CREATE INDEX IF NOT EXISTS idx_sardine_predictions_probability ON sardine_predictions (probability);
CREATE INDEX IF NOT EXISTS idx_sardine_predictions_expires ON sardine_predictions (expires_at);

-- Tabla de reportes de cardúmenes (confirmaciones)
CREATE TABLE IF NOT EXISTS sardine_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    location GEOMETRY(POINT, 4326) NOT NULL,
    zone_id UUID REFERENCES ocean_zones(id) ON DELETE SET NULL,
    report_date TIMESTAMP WITH TIME ZONE NOT NULL,
    report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('sighting', 'catch', 'absence', 'migration')),
    verification_status VARCHAR(20) DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'disputed')),
    estimated_quantity INTEGER,
    estimated_size VARCHAR(20) CHECK (estimated_size IN ('small', 'medium', 'large', 'very_large')),
    depth DECIMAL(10,2),
    temperature DECIMAL(5,2),
    salinity DECIMAL(5,2),
    current_speed DECIMAL(5,2),
    current_direction INTEGER,
    weather_conditions VARCHAR(100),
    water_clarity VARCHAR(50),
    fishing_method VARCHAR(50),
    catch_weight DECIMAL(10,2), -- peso de la captura en kg
    images TEXT[], -- URLs de imágenes
    notes TEXT,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para reportes
CREATE INDEX IF NOT EXISTS idx_sardine_reports_location ON sardine_reports USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_sardine_reports_date ON sardine_reports (report_date);
CREATE INDEX IF NOT EXISTS idx_sardine_reports_user ON sardine_reports (user_id);
CREATE INDEX IF NOT EXISTS idx_sardine_reports_status ON sardine_reports (verification_status);

-- Tabla de datos de tráfico marítimo
CREATE TABLE IF NOT EXISTS vessel_traffic (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mmsi BIGINT, -- Maritime Mobile Service Identity
    vessel_name VARCHAR(100),
    vessel_type VARCHAR(50),
    length DECIMAL(6,2),
    width DECIMAL(6,2),
    draft DECIMAL(6,2),
    location GEOMETRY(POINT, 4326) NOT NULL,
    course INTEGER, -- grados
    speed DECIMAL(5,2), -- nudos
    heading INTEGER, -- grados
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    destination VARCHAR(100),
    status VARCHAR(20),
    data_source VARCHAR(20) NOT NULL CHECK (data_source IN ('ais', 'user_report', 'satellite')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para tráfico marítimo
CREATE INDEX IF NOT EXISTS idx_vessel_traffic_location ON vessel_traffic USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_vessel_traffic_timestamp ON vessel_traffic (timestamp);
CREATE INDEX IF NOT EXISTS idx_vessel_traffic_mmsi ON vessel_traffic (mmsi);
CREATE INDEX IF NOT EXISTS idx_vessel_traffic_type ON vessel_traffic (vessel_type);

-- Tabla de alertas
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('weather', 'sardine_prediction', 'conservation', 'regulation', 'safety', 'system')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    location GEOMETRY(POINT, 4326),
    zone_id UUID REFERENCES ocean_zones(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para alertas
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts (alert_type);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts (severity);
CREATE INDEX IF NOT EXISTS idx_alerts_active ON alerts (is_active);
CREATE INDEX IF NOT EXISTS idx_alerts_expires ON alerts (expires_at);
CREATE INDEX IF NOT EXISTS idx_alerts_location ON alerts USING GIST (location);

-- Tabla de notificaciones de usuarios
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_id UUID REFERENCES alerts(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_delivered BOOLEAN DEFAULT false,
    delivery_method VARCHAR(20) DEFAULT 'app' CHECK (delivery_method IN ('app', 'email', 'push', 'sms')),
    scheduled_for TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    read_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para notificaciones
CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_read ON user_notifications (is_read);
CREATE INDEX IF NOT EXISTS idx_user_notifications_delivered ON user_notifications (is_delivered);
CREATE INDEX IF NOT EXISTS idx_user_notifications_type ON user_notifications (notification_type);

-- Tabla de rutas de pesca
CREATE TABLE IF NOT EXISTS fishing_routes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    route_data GEOMETRY(LINESTRING, 4326) NOT NULL,
    waypoints JSONB DEFAULT '[]', -- array de puntos con metadata
    distance DECIMAL(10,2), -- distancia en km
    estimated_duration INTEGER, -- duración estimada en minutos
    difficulty INTEGER CHECK (difficulty >= 1 AND difficulty <= 5),
    seasonality VARCHAR(50), -- temporada recomendada
    is_public BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para rutas
CREATE INDEX IF NOT EXISTS idx_fishing_routes_user ON fishing_routes (user_id);
CREATE INDEX IF NOT EXISTS idx_fishing_routes_public ON fishing_routes (is_public);
CREATE INDEX IF NOT EXISTS idx_fishing_routes_active ON fishing_routes (is_active);
CREATE INDEX IF NOT EXISTS idx_fishing_routes_route ON fishing_routes USING GIST (route_data);

-- Tabla de sesiones de pesca
CREATE TABLE IF NOT EXISTS fishing_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    route_id UUID REFERENCES fishing_routes(id) ON DELETE SET NULL,
    vessel_name VARCHAR(100),
    vessel_type VARCHAR(50),
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    start_location GEOMETRY(POINT, 4326) NOT NULL,
    end_location GEOMETRY(POINT, 4326),
    actual_route GEOMETRY(LINESTRING, 4326),
    distance_covered DECIMAL(10,2),
    fuel_consumed DECIMAL(10,2),
    catch_data JSONB DEFAULT '{}', -- datos de capturas
    weather_conditions JSONB DEFAULT '{}',
    notes TEXT,
    is_completed BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para sesiones de pesca
CREATE INDEX IF NOT EXISTS idx_fishing_sessions_user ON fishing_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_fishing_sessions_route ON fishing_sessions (route_id);
CREATE INDEX IF NOT EXISTS idx_fishing_sessions_start_time ON fishing_sessions (start_time);
CREATE INDEX IF NOT EXISTS idx_fishing_sessions_completed ON fishing_sessions (is_completed);

-- Tabla de datos de batimetría
CREATE TABLE IF NOT EXISTS bathymetry_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location GEOMETRY(POINT, 4326) NOT NULL,
    depth DECIMAL(10,2) NOT NULL,
    uncertainty DECIMAL(10,2),
    data_source VARCHAR(50) NOT NULL,
    resolution DECIMAL(10,2), -- resolución en metros
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Índices para batimetría
CREATE INDEX IF NOT EXISTS idx_bathymetry_data_location ON bathymetry_data USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_bathymetry_data_depth ON bathymetry_data (depth);

-- Tabla de datos satelitales
CREATE TABLE IF NOT EXISTS satellite_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    satellite_name VARCHAR(50) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    acquisition_time TIMESTAMP WITH TIME ZONE NOT NULL,
    processing_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    bounds GEOMETRY(POLYGON, 4326) NOT NULL,
    resolution DECIMAL(10,2), -- resolución en metros
    data_type VARCHAR(50) NOT NULL CHECK (data_type IN ('sst', 'chlorophyll', 'altimetry', 'wind', 'waves')),
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para datos satelitales
CREATE INDEX IF NOT EXISTS idx_satellite_data_time ON satellite_data (acquisition_time);
CREATE INDEX IF NOT EXISTS idx_satellite_data_type ON satellite_data (data_type);
CREATE INDEX IF NOT EXISTS idx_satellite_data_bounds ON satellite_data USING GIST (bounds);

-- Tabla de modelos de ML
CREATE TABLE IF NOT EXISTS ml_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    version VARCHAR(20) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    description TEXT,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    accuracy DECIMAL(5,4),
    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),
    training_data_size INTEGER,
    validation_data_size INTEGER,
    features JSONB DEFAULT '{}',
    hyperparameters JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_production BOOLEAN DEFAULT false,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de ejecuciones de modelos
CREATE TABLE IF NOT EXISTS ml_model_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_id UUID NOT NULL REFERENCES ml_models(id) ON DELETE CASCADE,
    execution_type VARCHAR(20) NOT NULL CHECK (execution_type IN ('training', 'prediction', 'validation')),
    input_data JSONB NOT NULL,
    output_data JSONB,
    execution_time INTEGER, -- milisegundos
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    error_message TEXT,
    executed_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Tabla de logs del sistema
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
    message TEXT NOT NULL,
    component VARCHAR(50),
    user_id UUID REFERENCES users(id),
    request_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para logs
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs (level);
CREATE INDEX IF NOT EXISTS idx_system_logs_component ON system_logs (component);
CREATE INDEX IF NOT EXISTS idx_system_logs_created ON system_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_system_logs_user ON system_logs (user_id);

-- Tabla de métricas del sistema
CREATE TABLE IF NOT EXISTS system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(20,10) NOT NULL,
    metric_type VARCHAR(20) NOT NULL CHECK (metric_type IN ('gauge', 'counter', 'histogram')),
    tags JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Índices para métricas
CREATE INDEX IF NOT EXISTS idx_system_metrics_name ON system_metrics (metric_name);
CREATE INDEX IF NOT EXISTS idx_system_metrics_timestamp ON system_metrics (timestamp);
CREATE INDEX IF NOT EXISTS idx_system_metrics_type ON system_metrics (metric_type);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_sensitive BOOLEAN DEFAULT false,
    environment VARCHAR(20) DEFAULT 'all' CHECK (environment IN ('development', 'staging', 'production', 'all')),
    version INTEGER DEFAULT 1,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Funciones y triggers

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at en tablas que lo necesiten
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ocean_zones_updated_at BEFORE UPDATE ON ocean_zones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sardine_reports_updated_at BEFORE UPDATE ON sardine_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fishing_routes_updated_at BEFORE UPDATE ON fishing_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fishing_sessions_updated_at BEFORE UPDATE ON fishing_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_ml_models_updated_at BEFORE UPDATE ON ml_models FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_system_config_updated_at BEFORE UPDATE ON system_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Función para calcular la distancia entre dos puntos geográficos
CREATE OR REPLACE FUNCTION calculate_distance(
    point1 GEOMETRY(POINT, 4326),
    point2 GEOMETRY(POINT, 4326)
) RETURNS DECIMAL(10,2) AS $$
BEGIN
    RETURN ST_Distance(point1::geography, point2::geography) / 1000; -- distancia en km
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Función para obtener datos oceanográficos promedio en un radio específico
CREATE OR REPLACE FUNCTION get_avg_oceanographic_data(
    center GEOMETRY(POINT, 4326),
    radius_km DECIMAL(10,2),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE
) RETURNS TABLE (
    avg_temperature_surface DECIMAL(5,2),
    avg_temperature_subsurface DECIMAL(5,2),
    avg_salinity DECIMAL(5,2),
    avg_chlorophyll DECIMAL(8,6),
    avg_current_speed DECIMAL(5,2),
    avg_wave_height DECIMAL(4,2),
    data_points INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(od.temperature_surface) as avg_temperature_surface,
        AVG(od.temperature_subsurface) as avg_temperature_subsurface,
        AVG(od.salinity) as avg_salinity,
        AVG(od.chlorophyll) as avg_chlorophyll,
        AVG(od.current_speed) as avg_current_speed,
        AVG(od.wave_height) as avg_wave_height,
        COUNT(*) as data_points
    FROM oceanographic_data od
    WHERE 
        ST_DWithin(od.location::geography, center::geography, radius_km * 1000)
        AND od.timestamp BETWEEN start_time AND end_time;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener predicciones activas en un área
CREATE OR REPLACE FUNCTION get_active_predictions_in_area(
    bounds GEOMETRY(POLYGON, 4326)
) RETURNS TABLE (
    id UUID,
    location GEOMETRY(POINT, 4326),
    probability DECIMAL(5,4),
    estimated_density DECIMAL(10,2),
    school_size VARCHAR(20),
    prediction_model VARCHAR(50),
    expires_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        sp.id,
        sp.location,
        sp.probability,
        sp.estimated_density,
        sp.school_size,
        sp.prediction_model,
        sp.expires_at
    FROM sardine_predictions sp
    WHERE 
        ST_Within(sp.location, bounds)
        AND sp.expires_at > NOW()
        AND sp.probability > 0.5
    ORDER BY sp.probability DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar datos antiguos
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Limpiar logs antiguos (más de 90 días)
    DELETE FROM system_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % old system log entries', deleted_count;
    
    -- Limpiar métricas antiguas (más de 30 días)
    DELETE FROM system_metrics 
    WHERE timestamp < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % old metric entries', deleted_count;
    
    -- Limpiar notificaciones leídas antiguas (más de 60 días)
    DELETE FROM user_notifications 
    WHERE is_read = true AND read_at < NOW() - INTERVAL '60 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % old notification entries', deleted_count;
    
    -- Limpiar sesiones expiradas
    DELETE FROM sessions 
    WHERE expires_at < NOW() OR is_active = false;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Deleted % expired sessions', deleted_count;
    
    RETURN 1;
END;
$$ LANGUAGE plpgsql;

-- Crear vista para resumen de actividad reciente
CREATE OR REPLACE VIEW recent_activity_summary AS
SELECT 
    (SELECT COUNT(*) FROM sardine_reports WHERE created_at > NOW() - INTERVAL '24 hours') as recent_reports,
    (SELECT COUNT(*) FROM sardine_predictions WHERE created_at > NOW() - INTERVAL '24 hours') as recent_predictions,
    (SELECT COUNT(*) FROM users WHERE last_login > NOW() - INTERVAL '24 hours') as active_users,
    (SELECT COUNT(*) FROM alerts WHERE is_active = true AND severity = 'critical') as critical_alerts,
    (SELECT COUNT(*) FROM vessel_traffic WHERE timestamp > NOW() - INTERVAL '1 hour') as recent_vessel_positions,
    (SELECT AVG(temperature_surface) FROM oceanographic_data WHERE timestamp > NOW() - INTERVAL '6 hours' AND temperature_surface IS NOT NULL) as avg_temperature;

-- Crear vista para estadísticas de usuario
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.username,
    u.full_name,
    u.role,
    u.created_at,
    u.last_login,
    (SELECT COUNT(*) FROM sardine_reports WHERE user_id = u.id) as total_reports,
    (SELECT COUNT(*) FROM fishing_routes WHERE user_id = u.id) as total_routes,
    (SELECT COUNT(*) FROM fishing_sessions WHERE user_id = u.id) as total_sessions,
    (SELECT MAX(created_at) FROM sardine_reports WHERE user_id = u.id) as last_report_date,
    (SELECT COUNT(*) FROM user_notifications WHERE user_id = u.id AND is_read = false) as unread_notifications
FROM users u
WHERE u.is_active = true;

-- Crear vista para calidad de datos
CREATE OR REPLACE VIEW data_quality_summary AS
SELECT 
    data_source,
    COUNT(*) as total_records,
    COUNT(*) FILTER (WHERE temperature_surface IS NOT NULL) as temperature_records,
    COUNT(*) FILTER (WHERE salinity IS NOT NULL) as salinity_records,
    COUNT(*) FILTER (WHERE chlorophyll IS NOT NULL) as chlorophyll_records,
    COUNT(*) FILTER (WHERE current_speed IS NOT NULL) as current_records,
    AVG(temperature_surface) as avg_temperature,
    AVG(salinity) as avg_salinity,
    AVG(chlorophyll) as avg_chlorophyll,
    MIN(timestamp) as earliest_record,
    MAX(timestamp) as latest_record
FROM oceanographic_data
GROUP BY data_source;

-- Política de seguridad para RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sardine_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fishing_sessions ENABLE ROW LEVEL SECURITY;

-- Políticas para usuarios
CREATE POLICY "Users can view their own data" ON users
    FOR SELECT USING (id = current_setting('app.current_user_id', true)::UUID OR current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Users can update their own data" ON users
    FOR UPDATE USING (id = current_setting('app.current_user_id', true)::UUID);

-- Políticas para reportes de sardinas
CREATE POLICY "Users can view their own reports" ON sardine_reports
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::UUID OR current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Users can create reports" ON sardine_reports
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY "Users can update their own reports" ON sardine_reports
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Políticas para rutas de pesca
CREATE POLICY "Users can view public routes or their own" ON fishing_routes
    FOR SELECT USING (is_public = true OR user_id = current_setting('app.current_user_id', true)::UUID OR current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Users can create routes" ON fishing_routes
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY "Users can update their own routes" ON fishing_routes
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Políticas para sesiones de pesca
CREATE POLICY "Users can view their own sessions" ON fishing_sessions
    FOR SELECT USING (user_id = current_setting('app.current_user_id', true)::UUID OR current_setting('app.current_user_role', true) = 'admin');

CREATE POLICY "Users can create sessions" ON fishing_sessions
    FOR INSERT WITH CHECK (user_id = current_setting('app.current_user_id', true)::UUID);

CREATE POLICY "Users can update their own sessions" ON fishing_sessions
    FOR UPDATE USING (user_id = current_setting('app.current_user_id', true)::UUID);

-- Insertar configuración por defecto
INSERT INTO system_config (config_key, config_value, description) VALUES
('app_name', '"SARDIN-AI"', 'Nombre de la aplicación'),
('app_version', '"2.0.0"', 'Versión de la aplicación'),
('max_prediction_age_hours', '24', 'Edad máxima en horas para predicciones activas'),
('default_search_radius_km', '10', 'Radio de búsqueda predeterminado en km'),
('max_upload_size_mb', '10', 'Tamaño máximo de archivo en MB'),
('session_timeout_hours', '24', 'Tiempo de espera de sesión en horas'),
('enable_email_notifications', 'true', 'Habilitar notificaciones por email'),
('enable_push_notifications', 'true', 'Habilitar notificaciones push'),
('map_default_center', '[-116.6167, 31.8667]', 'Centro predeterminado del mapa [lng, lat]'),
('map_default_zoom', '8', 'Zoom predeterminado del mapa'),
('data_retention_days', '365', 'Días de retención de datos'),
('ml_model_refresh_interval_hours', '6', 'Intervalo de actualización del modelo ML en horas'),
('api_rate_limit_requests', '100', 'Límite de velocidad de API en solicitudes por minuto')
ON CONFLICT (config_key) DO UPDATE SET
    config_value = EXCLUDED.config_value,
    updated_at = NOW();

-- Insertar zonas oceánicas por defecto para Ensenada
INSERT INTO ocean_zones (name, description, geometry, zone_type, depth_min, depth_max, temperature_min, temperature_max) VALUES
('Zona de Pesca Costa Afuera', 'Zona de pesca principal frente a Ensenada', 
 ST_GeomFromText('POLYGON((-117.2 32.0, -117.2 31.6, -116.8 31.6, -116.8 32.0, -117.2 32.0))', 4326),
 'fishing', 50, 200, 16, 20),
('Zona de Reproducción Bahía de Todos Santos', 'Área protegida de reproducción',
 ST_GeomFromText('POLYGON((-116.8 31.8, -116.8 31.6, -116.6 31.6, -116.6 31.8, -116.8 31.8))', 4326),
 'breeding', 10, 50, 17, 21),
('Zona de Migración Estacional', 'Corredor migratorio estacional de sardinas',
 ST_GeomFromText('POLYGON((-117.0 31.9, -117.0 31.7, -116.7 31.7, -116.7 31.9, -117.0 31.9))', 4326),
 'migration', 30, 150, 16, 19),
('Zona de Investigación CICESE', 'Área de monitoreo e investigación',
 ST_GeomFromText('POLYGON((-116.9 31.85, -116.9 31.75, -116.75 31.75, -116.75 31.85, -116.9 31.85))', 4326),
 'research', 20, 100, 16, 20)
ON CONFLICT DO NOTHING;

-- Crear usuario administrador por defecto (contraseña: admin123)
INSERT INTO users (username, email, password_hash, full_name, role, is_active, email_verified) VALUES
('admin', 'admin@sardin-ai.local', crypt('admin123', gen_salt('bf')), 'Administrador SARDIN-AI', 'admin', true, true)
ON CONFLICT (username) DO UPDATE SET
    email = EXCLUDED.email,
    password_hash = EXCLUDED.password_hash,
    full_name = EXCLUDED.full_name,
    updated_at = NOW();

-- Confirmar que todo se ha creado correctamente
DO $$
BEGIN
    RAISE NOTICE 'Base de datos SARDIN-AI inicializada correctamente';
    RAISE NOTICE 'Usuario administrador creado: admin / admin123';
    RAISE NOTICE 'Total de tablas creadas: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'sardin_ai');
    RAISE NOTICE 'Total de índices creados: %', (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'sardin_ai');
    RAISE NOTICE 'Total de funciones creadas: %', (SELECT COUNT(*) FROM pg_proc WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'sardin_ai'));
    RAISE NOTICE 'Total de vistas creadas: %', (SELECT COUNT(*) FROM information_schema.views WHERE table_schema = 'sardin_ai');
END $$;