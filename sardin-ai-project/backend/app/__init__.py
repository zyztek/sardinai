from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_caching import Cache
from supabase import create_client
import redis
import os

# Initialize extensions
db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)
cache = Cache()

# Initialize Supabase
supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_KEY')
supabase = create_client(supabase_url, supabase_key)

# Initialize Redis
redis_client = redis.from_url(os.environ.get('REDIS_URL', 'redis://localhost:6379/0'))

def create_app(config_name='default'):
    app = Flask(__name__)
    
    # Load configuration
    from config import config
    app.config.from_object(config[config_name])
    
    # Initialize extensions with app
    db.init_app(app)
    jwt.init_app(app)
    cors.init_app(app)
    limiter.init_app(app)
    cache.init_app(app)
    
    # Register blueprints
    from app.routes.auth import auth_bp
    from app.routes.chat_analysis import chat_analysis_bp
    from app.routes.oceanographic import oceanographic_bp
    from app.routes.fisheries import fisheries_bp
    from app.routes.reports import reports_bp
    
    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(chat_analysis_bp, url_prefix='/api/chat')
    app.register_blueprint(oceanographic_bp, url_prefix='/api/ocean')
    app.register_blueprint(fisheries_bp, url_prefix='/api/fisheries')
    app.register_blueprint(reports_bp, url_prefix='/api/reports')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return {'error': 'Not found'}, 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return {'error': 'Internal server error'}, 500
    
    @app.errorhandler(429)
    def rate_limit_exceeded(error):
        return {'error': 'Rate limit exceeded'}, 429
    
    # Health check endpoint
    @app.route('/health')
    def health_check():
        return {'status': 'healthy', 'service': 'SARDIN-AI Backend'}
    
    return app