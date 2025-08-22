from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, cache
from app.models import FishPrediction, VesselTrack
from app.services.prediction_service import PredictionService
from app.services.marinetraffic_service import MarineTrafficService
import json
from datetime import datetime, timedelta

fisheries_bp = Blueprint('fisheries', __name__)

@fisheries_bp.route('/predict', methods=['POST'])
@jwt_required()
def predict_fish_location():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['species', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        species = data['species']
        latitude = data['latitude']
        longitude = data['longitude']
        
        # Initialize prediction service
        prediction_service = PredictionService()
        
        # Get prediction
        prediction_result = prediction_service.predict_fish_location(
            species, latitude, longitude
        )
        
        # Save prediction to database
        prediction = FishPrediction(
            user_id=user_id,
            species=species,
            location=f"Prediction ({latitude}, {longitude})",
            latitude=latitude,
            longitude=longitude,
            probability=prediction_result['probability'],
            confidence_interval=prediction_result.get('confidence_interval'),
            prediction_factors=json.dumps(prediction_result.get('factors', {})),
            expires_at=datetime.utcnow() + timedelta(hours=24)  # Prediction expires in 24 hours
        )
        
        db.session.add(prediction)
        db.session.commit()
        
        return jsonify({
            'message': 'Fish prediction generated successfully',
            'prediction': prediction.to_dict(),
            'details': prediction_result
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/predictions', methods=['GET'])
@jwt_required()
def get_predictions():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        species = request.args.get('species')
        
        query = FishPrediction.query.filter_by(user_id=user_id)
        
        if species:
            query = query.filter_by(species=species)
        
        # Only show active predictions (not expired)
        query = query.filter(
            (FishPrediction.expires_at.is_(None)) |
            (FishPrediction.expires_at > datetime.utcnow())
        )
        
        predictions = query.order_by(FishPrediction.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'predictions': [pred.to_dict() for pred in predictions.items],
            'total': predictions.total,
            'pages': predictions.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/predictions/<int:prediction_id>', methods=['GET'])
@jwt_required()
def get_prediction(prediction_id):
    try:
        user_id = get_jwt_identity()
        prediction = FishPrediction.query.filter_by(id=prediction_id, user_id=user_id).first()
        
        if not prediction:
            return jsonify({'error': 'Prediction not found'}), 404
        
        # Check if prediction is expired
        if prediction.expires_at and prediction.expires_at < datetime.utcnow():
            return jsonify({'error': 'Prediction has expired'}), 410
        
        return jsonify({
            'prediction': prediction.to_dict(),
            'factors': json.loads(prediction.prediction_factors) if prediction.prediction_factors else {}
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/vessels', methods=['POST'])
@jwt_required()
def add_vessel_track():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['mmsi', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        vessel_track = VesselTrack(
            mmsi=data['mmsi'],
            vessel_name=data.get('vessel_name'),
            vessel_type=data.get('vessel_type'),
            latitude=data['latitude'],
            longitude=data['longitude'],
            speed=data.get('speed'),
            course=data.get('course'),
            data_source=data.get('data_source', 'user_input')
        )
        
        db.session.add(vessel_track)
        db.session.commit()
        
        return jsonify({
            'message': 'Vessel track added successfully',
            'vessel': vessel_track.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/vessels', methods=['GET'])
@jwt_required()
def get_vessel_tracks():
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        vessel_type = request.args.get('vessel_type')
        
        query = VesselTrack.query
        
        if vessel_type:
            query = query.filter_by(vessel_type=vessel_type)
        
        # Get recent tracks (last 24 hours)
        query = query.filter(
            VesselTrack.timestamp >= datetime.utcnow() - timedelta(hours=24)
        )
        
        vessel_tracks = query.order_by(VesselTrack.timestamp.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'vessels': [vessel.to_dict() for vessel in vessel_tracks.items],
            'total': vessel_tracks.total,
            'pages': vessel_tracks.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/vessels/fetch/marinetraffic', methods=['POST'])
@jwt_required()
def fetch_marinetraffic_data():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('area'):
            return jsonify({'error': 'Area is required'}), 400
        
        area = data['area']  # e.g., "32.5,-117.5,31.5,-116.5" (lat1,lon1,lat2,lon2)
        
        # Initialize MarineTraffic service
        traffic_service = MarineTrafficService()
        
        # Fetch vessel data from MarineTraffic
        vessels_data = traffic_service.get_vessels_in_area(area)
        
        # Save vessel tracks to database
        saved_vessels = []
        for vessel_data in vessels_data:
            vessel_track = VesselTrack(
                mmsi=vessel_data.get('mmsi'),
                vessel_name=vessel_data.get('vessel_name'),
                vessel_type=vessel_data.get('vessel_type'),
                latitude=vessel_data.get('latitude'),
                longitude=vessel_data.get('longitude'),
                speed=vessel_data.get('speed'),
                course=vessel_data.get('course'),
                data_source='marinetraffic'
            )
            
            db.session.add(vessel_track)
            saved_vessels.append(vessel_track)
        
        db.session.commit()
        
        return jsonify({
            'message': f'MarineTraffic data fetched successfully. Saved {len(saved_vessels)} vessel tracks.',
            'vessels': [vessel.to_dict() for vessel in saved_vessels],
            'raw_data': vessels_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/heatmap/sardine', methods=['GET'])
@cache.cached(timeout=600)  # Cache for 10 minutes
def get_sardine_heatmap():
    try:
        # Get recent sardine predictions for heatmap
        recent_predictions = FishPrediction.query.filter(
            FishPrediction.species == 'sardina',
            FishPrediction.probability > 0.5,
            FishPrediction.expires_at > datetime.utcnow()
        ).all()
        
        heatmap_data = []
        for prediction in recent_predictions:
            heatmap_data.append({
                'lat': prediction.latitude,
                'lng': prediction.longitude,
                'weight': prediction.probability,
                'location': prediction.location
            })
        
        return jsonify({
            'heatmap_data': heatmap_data,
            'total_points': len(heatmap_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/routes/optimize', methods=['POST'])
@jwt_required()
def optimize_fishing_route():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['start_lat', 'start_lon', 'end_lat', 'end_lon', 'species']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Initialize prediction service
        prediction_service = PredictionService()
        
        # Optimize route
        route_result = prediction_service.optimize_fishing_route(
            start_lat=data['start_lat'],
            start_lon=data['start_lon'],
            end_lat=data['end_lat'],
            end_lon=data['end_lon'],
            species=data['species'],
            waypoints=data.get('waypoints', [])
        )
        
        return jsonify({
            'message': 'Fishing route optimized successfully',
            'route': route_result
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@fisheries_bp.route('/stats', methods=['GET'])
@cache.cached(timeout=3600)  # Cache for 1 hour
def get_fisheries_stats():
    try:
        stats = {
            'total_predictions': FishPrediction.query.count(),
            'active_predictions': FishPrediction.query.filter(
                FishPrediction.expires_at > datetime.utcnow()
            ).count(),
            'species_distribution': {},
            'vessel_tracking': {
                'total_tracks': VesselTrack.query.count(),
                'recent_activity': VesselTrack.query.filter(
                    VesselTrack.timestamp >= datetime.utcnow() - timedelta(hours=24)
                ).count()
            }
        }
        
        # Species distribution
        from sqlalchemy import func
        species_dist = db.session.query(
            FishPrediction.species,
            func.count(FishPrediction.id).label('count')
        ).group_by(FishPrediction.species).all()
        
        for species, count in species_dist:
            stats['species_distribution'][species] = count
        
        # Vessel types distribution
        vessel_types = db.session.query(
            VesselTrack.vessel_type,
            func.count(VesselTrack.id).label('count')
        ).filter(VesselTrack.vessel_type.isnot(None)).group_by(VesselTrack.vessel_type).all()
        
        stats['vessel_tracking']['type_distribution'] = {
            vessel_type: count for vessel_type, count in vessel_types
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500