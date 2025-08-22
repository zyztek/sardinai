from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from app import db

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    role = db.Column(db.String(20), default='user')  # user, admin, researcher
    
    # Relationships
    chat_sessions = db.relationship('ChatSession', backref='user', lazy=True)
    ocean_data = db.relationship('OceanData', backref='user', lazy=True)
    fish_predictions = db.relationship('FishPrediction', backref='user', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat(),
            'role': self.role,
            'is_active': self.is_active
        }

class ChatSession(db.Model):
    __tablename__ = 'chat_sessions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    chat_data = db.Column(db.Text, nullable=False)  # JSON string
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    analysis_results = db.relationship('ChatAnalysis', backref='chat_session', lazy=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'chat_data': self.chat_data,
            'created_at': self.created_at.isoformat()
        }

class ChatAnalysis(db.Model):
    __tablename__ = 'chat_analysis'
    
    id = db.Column(db.Integer, primary_key=True)
    chat_session_id = db.Column(db.Integer, db.ForeignKey('chat_sessions.id'), nullable=False)
    analysis_type = db.Column(db.String(50), nullable=False)  # sentiment, topics, summary
    result_data = db.Column(db.Text, nullable=False)  # JSON string
    confidence_score = db.Column(db.Float, default=0.0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'chat_session_id': self.chat_session_id,
            'analysis_type': self.analysis_type,
            'result_data': self.result_data,
            'confidence_score': self.confidence_score,
            'created_at': self.created_at.isoformat()
        }

class OceanData(db.Model):
    __tablename__ = 'ocean_data'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    location = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    temperature = db.Column(db.Float, nullable=True)  # Celsius
    chlorophyll = db.Column(db.Float, nullable=True)  # mg/m³
    salinity = db.Column(db.Float, nullable=True)  # PSU
    current_speed = db.Column(db.Float, nullable=True)  # m/s
    current_direction = db.Column(db.Float, nullable=True)  # degrees
    depth = db.Column(db.Float, nullable=True)  # meters
    data_source = db.Column(db.String(50), default='noaa')  # noaa, cicese, user_input
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'temperature': self.temperature,
            'chlorophyll': self.chlorophyll,
            'salinity': self.salinity,
            'current_speed': self.current_speed,
            'current_direction': self.current_direction,
            'depth': self.depth,
            'data_source': self.data_source,
            'timestamp': self.timestamp.isoformat()
        }

class FishPrediction(db.Model):
    __tablename__ = 'fish_predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    species = db.Column(db.String(50), nullable=False)  # sardina, atun, etc.
    location = db.Column(db.String(100), nullable=False)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    probability = db.Column(db.Float, nullable=False)  # 0.0 to 1.0
    confidence_interval = db.Column(db.Float, nullable=True)
    prediction_factors = db.Column(db.Text, nullable=True)  # JSON string
    model_version = db.Column(db.String(20), default='1.0')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)  # When prediction expires
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'species': self.species,
            'location': self.location,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'probability': self.probability,
            'confidence_interval': self.confidence_interval,
            'prediction_factors': self.prediction_factors,
            'model_version': self.model_version,
            'created_at': self.created_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None
        }

class VesselTrack(db.Model):
    __tablename__ = 'vessel_tracks'
    
    id = db.Column(db.Integer, primary_key=True)
    mmsi = db.Column(db.String(20), nullable=False)  # Maritime Mobile Service Identity
    vessel_name = db.Column(db.String(100), nullable=True)
    vessel_type = db.Column(db.String(50), nullable=True)
    latitude = db.Column(db.Float, nullable=False)
    longitude = db.Column(db.Float, nullable=False)
    speed = db.Column(db.Float, nullable=True)  # knots
    course = db.Column(db.Float, nullable=True)  # degrees
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    data_source = db.Column(db.String(20), default='ais')  # ais, marinetraffic
    
    def to_dict(self):
        return {
            'id': self.id,
            'mmsi': self.mmsi,
            'vessel_name': self.vessel_name,
            'vessel_type': self.vessel_type,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'speed': self.speed,
            'course': self.course,
            'timestamp': self.timestamp.isoformat(),
            'data_source': self.data_source
        }

class Report(db.Model):
    __tablename__ = 'reports'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(200), nullable=False)
    report_type = db.Column(db.String(50), nullable=False)  # pdf, markdown, analysis
    content = db.Column(db.Text, nullable=False)
    file_path = db.Column(db.String(500), nullable=True)
    generated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'title': self.title,
            'report_type': self.report_type,
            'content': self.content,
            'file_path': self.file_path,
            'generated_at': self.generated_at.isoformat()
        }