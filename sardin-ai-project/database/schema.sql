-- SARDIN-AI Database Schema
-- Sistema de Monitoreo Pesquero con Análisis de Chat

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table for authentication and authorization
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'researcher'))
);

-- Chat sessions table for storing conversation data
CREATE TABLE chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    chat_data TEXT NOT NULL, -- JSON string
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chat analysis results table
CREATE TABLE chat_analysis (
    id SERIAL PRIMARY KEY,
    chat_session_id INTEGER REFERENCES chat_sessions(id) ON DELETE CASCADE,
    analysis_type VARCHAR(50) NOT NULL CHECK (analysis_type IN ('sentiment', 'topics', 'summary')),
    result_data TEXT NOT NULL, -- JSON string
    confidence_score FLOAT DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Oceanographic data table
CREATE TABLE ocean_data (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    location VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    temperature DECIMAL(5, 2), -- Celsius
    chlorophyll DECIMAL(8, 6), -- mg/m³
    salinity DECIMAL(5, 2), -- PSU
    current_speed DECIMAL(5, 2), -- m/s
    current_direction DECIMAL(5, 2), -- degrees
    depth DECIMAL(8, 2), -- meters
    data_source VARCHAR(50) DEFAULT 'noaa' CHECK (data_source IN ('noaa', 'cicese', 'user_input')),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Add spatial index for location-based queries
    CONSTRAINT valid_coordinates CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    )
);

-- Add PostGIS geometry column for spatial queries
SELECT AddGeometryColumn('ocean_data', 'geom', 4326, 'POINT', 2);
CREATE INDEX idx_ocean_data_geom ON ocean_data USING GIST (geom);

-- Fish predictions table
CREATE TABLE fish_predictions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    species VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    probability DECIMAL(3, 2) NOT NULL CHECK (probability >= 0 AND probability <= 1),
    confidence_interval DECIMAL(3, 2),
    prediction_factors TEXT, -- JSON string
    model_version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_fish_coordinates CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    )
);

-- Add PostGIS geometry column for fish predictions
SELECT AddGeometryColumn('fish_predictions', 'geom', 4326, 'POINT', 2);
CREATE INDEX idx_fish_predictions_geom ON fish_predictions USING GIST (geom);

-- Vessel tracking table
CREATE TABLE vessel_tracks (
    id SERIAL PRIMARY KEY,
    mmsi VARCHAR(20) NOT NULL, -- Maritime Mobile Service Identity
    vessel_name VARCHAR(100),
    vessel_type VARCHAR(50),
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2), -- knots
    course DECIMAL(5, 2), -- degrees
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_source VARCHAR(20) DEFAULT 'ais' CHECK (data_source IN ('ais', 'marinetraffic', 'user_input')),
    
    CONSTRAINT valid_vessel_coordinates CHECK (
        latitude >= -90 AND latitude <= 90 AND
        longitude >= -180 AND longitude <= 180
    )
);

-- Add PostGIS geometry column for vessel tracks
SELECT AddGeometryColumn('vessel_tracks', 'geom', 4326, 'POINT', 2);
CREATE INDEX idx_vessel_tracks_geom ON vessel_tracks USING GIST (geom);

-- Reports table
CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('pdf', 'markdown', 'analysis')),
    content TEXT NOT NULL,
    file_path VARCHAR(500),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX idx_chat_analysis_session_id ON chat_analysis(chat_session_id);
CREATE INDEX idx_chat_analysis_type ON chat_analysis(analysis_type);
CREATE INDEX idx_ocean_data_user_id ON ocean_data(user_id);
CREATE INDEX idx_ocean_data_timestamp ON ocean_data(timestamp);
CREATE INDEX idx_ocean_data_source ON ocean_data(data_source);
CREATE INDEX idx_fish_predictions_user_id ON fish_predictions(user_id);
CREATE INDEX idx_fish_predictions_species ON fish_predictions(species);
CREATE INDEX idx_fish_predictions_created_at ON fish_predictions(created_at);
CREATE INDEX idx_fish_predictions_expires_at ON fish_predictions(expires_at);
CREATE INDEX idx_vessel_tracks_mmsi ON vessel_tracks(mmsi);
CREATE INDEX idx_vessel_tracks_timestamp ON vessel_tracks(timestamp);
CREATE INDEX idx_vessel_tracks_source ON vessel_tracks(data_source);
CREATE INDEX idx_reports_user_id ON reports(user_id);
CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_generated_at ON reports(generated_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to users table
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance(
    lat1 DECIMAL, lon1 DECIMAL,
    lat2 DECIMAL, lon2 DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    distance DECIMAL;
BEGIN
    distance = 6371 * ACOS(
        COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * 
        COS(RADIANS(lon2) - RADIANS(lon1)) + 
        SIN(RADIANS(lat1)) * SIN(RADIANS(lat2))
    );
    RETURN distance;
END;
$$ LANGUAGE plpgsql;

-- Create view for active fish predictions
CREATE VIEW active_fish_predictions AS
SELECT fp.*, u.username as user_name
FROM fish_predictions fp
JOIN users u ON fp.user_id = u.id
WHERE (fp.expires_at IS NULL OR fp.expires_at > CURRENT_TIMESTAMP)
  AND fp.probability > 0.5;

-- Create view for recent oceanographic data
CREATE VIEW recent_oceanographic_data AS
SELECT od.*, u.username as user_name
FROM ocean_data od
LEFT JOIN users u ON od.user_id = u.id
WHERE od.timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
ORDER BY od.timestamp DESC;

-- Create view for vessel activity summary
CREATE VIEW vessel_activity_summary AS
SELECT 
    DATE_TRUNC('day', timestamp) as day,
    data_source,
    COUNT(*) as vessel_count,
    AVG(speed) as avg_speed,
    COUNT(DISTINCT mmsi) as unique_vessels
FROM vessel_tracks
WHERE timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', timestamp), data_source
ORDER BY day DESC;

-- Create function to cleanup expired predictions
CREATE OR REPLACE FUNCTION cleanup_expired_predictions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM fish_predictions 
    WHERE expires_at IS NOT NULL AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get ocean statistics for a region
CREATE OR REPLACE FUNCTION get_ocean_statistics(
    min_lat DECIMAL, max_lat DECIMAL,
    min_lon DECIMAL, max_lon DECIMAL,
    start_time TIMESTAMP DEFAULT NULL,
    end_time TIMESTAMP DEFAULT NULL
)
RETURNS TABLE (
    avg_temperature DECIMAL,
    min_temperature DECIMAL,
    max_temperature DECIMAL,
    avg_chlorophyll DECIMAL,
    min_chlorophyll DECIMAL,
    max_chlorophyll DECIMAL,
    data_point_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(temperature) as avg_temperature,
        MIN(temperature) as min_temperature,
        MAX(temperature) as max_temperature,
        AVG(chlorophyll) as avg_chlorophyll,
        MIN(chlorophyll) as min_chlorophyll,
        MAX(chlorophyll) as max_chlorophyll,
        COUNT(*) as data_point_count
    FROM ocean_data
    WHERE latitude BETWEEN min_lat AND max_lat
      AND longitude BETWEEN min_lon AND max_lon
      AND (start_time IS NULL OR timestamp >= start_time)
      AND (end_time IS NULL OR timestamp <= end_time)
      AND temperature IS NOT NULL
      AND chlorophyll IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Insert default admin user (password should be changed immediately)
INSERT INTO users (username, email, password_hash, role) VALUES 
('admin', 'admin@sardin-ai.com', crypt('admin123', gen_salt('bf')), 'admin')
ON CONFLICT (email) DO NOTHING;

-- Create RLS (Row Level Security) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocean_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE fish_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vessel_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can view own data" ON users
    FOR SELECT USING (id = auth.uid()::integer OR auth.uid()::integer IS NULL);

CREATE POLICY "Users can insert own data" ON users
    FOR INSERT WITH CHECK (auth.uid()::integer IS NULL);

CREATE POLICY "Users can update own data" ON users
    FOR UPDATE USING (id = auth.uid()::integer);

-- Chat sessions policies
CREATE POLICY "Users can view own chat sessions" ON chat_sessions
    FOR SELECT USING (user_id = auth.uid()::integer);

CREATE POLICY "Users can create own chat sessions" ON chat_sessions
    FOR INSERT WITH CHECK (user_id = auth.uid()::integer);

CREATE POLICY "Users can update own chat sessions" ON chat_sessions
    FOR UPDATE USING (user_id = auth.uid()::integer);

CREATE POLICY "Users can delete own chat sessions" ON chat_sessions
    FOR DELETE USING (user_id = auth.uid()::integer);

-- Similar policies for other tables...
CREATE POLICY "Users can view own ocean data" ON ocean_data
    FOR SELECT USING (user_id = auth.uid()::integer OR user_id IS NULL);

CREATE POLICY "Users can insert ocean data" ON ocean_data
    FOR INSERT WITH CHECK (user_id = auth.uid()::integer OR user_id IS NULL);

CREATE POLICY "Users can update own ocean data" ON ocean_data
    FOR UPDATE USING (user_id = auth.uid()::integer);

CREATE POLICY "Users can delete own ocean data" ON ocean_data
    FOR DELETE USING (user_id = auth.uid()::integer);

-- Admin can view all data
CREATE POLICY "Admin can view all data" ON users
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'));

CREATE POLICY "Admin can view all chat sessions" ON chat_sessions
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'));

CREATE POLICY "Admin can view all ocean data" ON ocean_data
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'));

CREATE POLICY "Admin can view all fish predictions" ON fish_predictions
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'));

CREATE POLICY "Admin can view all vessel tracks" ON vessel_tracks
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'));

CREATE POLICY "Admin can view all reports" ON reports
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid()::integer AND role = 'admin'));

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Create database version table for migrations
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) VALUES (1, 'Initial schema creation');