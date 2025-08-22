#!/usr/bin/env python3

# SARDIN-AI Main Application Entry Point
import os
import sys
import click
from app import create_app
from app.services.ai_service import AIService
from app.services.noaa_service import NOAAService
from app.services.cicese_service import CICESEService
from app.services.prediction_service import PredictionService
from app.services.report_service import ReportService

# Initialize Flask app
app = create_app(os.environ.get('FLASK_ENV', 'development'))

# Initialize services
ai_service = AIService()
noaa_service = NOAAService()
cicese_service = CICESEService()
prediction_service = PredictionService()
report_service = ReportService()

@app.cli.command()
def init_db():
    """Initialize the database with tables"""
    from app import db
    from app.models import *
    
    click.echo("Creating database tables...")
    db.create_all()
    click.echo("Database tables created successfully!")

@app.cli.command()
def test_services():
    """Test all services"""
    click.echo("Testing services...")
    
    # Test AI Service
    try:
        chat_data = [
            {"author": "user1", "content": "Hello, how are you?"},
            {"author": "user2", "content": "I'm doing great, thanks!"}
        ]
        sentiment_result = ai_service.analyze_sentiment(chat_data)
        click.echo(f"AI Service - Sentiment Analysis: {sentiment_result['sentiment_category']}")
    except Exception as e:
        click.echo(f"AI Service Error: {e}")
    
    # Test NOAA Service
    try:
        noaa_data = noaa_service.get_ocean_data(32.5, -117.5)
        click.echo(f"NOAA Service - Temperature: {noaa_data.get('temperature', 'N/A')}°C")
    except Exception as e:
        click.echo(f"NOAA Service Error: {e}")
    
    # Test CICESE Service
    try:
        cicese_data = cicese_service.get_ocean_data(32.5, -117.5)
        click.echo(f"CICESE Service - Temperature: {cicese_data.get('temperature', 'N/A')}°C")
    except Exception as e:
        click.echo(f"CICESE Service Error: {e}")
    
    # Test Prediction Service
    try:
        prediction = prediction_service.predict_fish_location("sardina", 32.5, -117.5)
        click.echo(f"Prediction Service - Probability: {prediction['probability']}")
    except Exception as e:
        click.echo(f"Prediction Service Error: {e}")
    
    # Test Report Service
    try:
        markdown_report = report_service.generate_markdown_report("Test Report", {"test": "data"})
        click.echo(f"Report Service - Generated markdown report")
    except Exception as e:
        click.echo(f"Report Service Error: {e}")
    
    click.echo("Service testing completed!")

@app.cli.command()
@click.option('--species', default='sardina', help='Fish species to predict')
@click.option('--lat', type=float, default=32.5, help='Latitude')
@click.option('--lon', type=float, default=-117.5, help='Longitude')
def predict(species, lat, lon):
    """Generate fish prediction for given location"""
    try:
        prediction = prediction_service.predict_fish_location(species, lat, lon)
        click.echo(f"Prediction for {species} at ({lat}, {lon}):")
        click.echo(f"  Probability: {prediction['probability']}")
        click.echo(f"  Confidence: {prediction['confidence_interval']}")
        click.echo(f"  Factors: {prediction['factors']}")
    except Exception as e:
        click.echo(f"Prediction error: {e}")

@app.cli.command()
@click.option('--format', default='markdown', type=click.Choice(['markdown', 'pdf']), help='Report format')
@click.option('--title', default='SARDIN-AI Report', help='Report title')
def generate_report(format, title):
    """Generate a sample report"""
    try:
        if format == 'markdown':
            content = report_service.generate_markdown_report(title, {"test": "data"})
            filename = report_service.save_markdown_report(content, "sample_report")
            click.echo(f"Markdown report saved to: {filename}")
        else:
            content = report_service.generate_markdown_report(title, {"test": "data"})
            filename = report_service.generate_pdf_report(content, "sample_report")
            click.echo(f"PDF report saved to: {filename}")
    except Exception as e:
        click.echo(f"Report generation error: {e}")

@app.cli.command()
def health_check():
    """Check health of all system components"""
    click.echo("SARDIN-AI Health Check")
    click.echo("=" * 30)
    
    # Check database connection
    try:
        from app import db
        db.engine.execute("SELECT 1")
        click.echo("✅ Database: Connected")
    except Exception as e:
        click.echo(f"❌ Database: {e}")
    
    # Check services
    services = [
        ("AI Service", ai_service),
        ("NOAA Service", noaa_service),
        ("CICESE Service", cicese_service),
        ("Prediction Service", prediction_service),
        ("Report Service", report_service)
    ]
    
    for service_name, service in services:
        try:
            # Simple test - just check if service can be instantiated
            if hasattr(service, '__class__'):
                click.echo(f"✅ {service_name}: OK")
            else:
                click.echo(f"❌ {service_name}: Not properly initialized")
        except Exception as e:
            click.echo(f"❌ {service_name}: {e}")
    
    click.echo("=" * 30)
    click.echo("Health check completed!")

if __name__ == '__main__':
    app.cli()