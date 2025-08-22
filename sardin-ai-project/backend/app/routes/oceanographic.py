from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, cache
from app.models import OceanData
from app.services.noaa_service import NOAAService
from app.services.cicese_service = CICESEService
import json
from datetime import datetime, timedelta

oceanographic_bp = Blueprint('oceanographic', __name__)

@oceanographic_bp.route('/data', methods=['POST'])
@jwt_required()
def add_ocean_data():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['location', 'latitude', 'longitude']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        ocean_data = OceanData(
            user_id=user_id,
            location=data['location'],
            latitude=data['latitude'],
            longitude=data['longitude'],
            temperature=data.get('temperature'),
            chlorophyll=data.get('chlorophyll'),
            salinity=data.get('salinity'),
            current_speed=data.get('current_speed'),
            current_direction=data.get('current_direction'),
            depth=data.get('depth'),
            data_source=data.get('data_source', 'user_input')
        )
        
        db.session.add(ocean_data)
        db.session.commit()
        
        return jsonify({
            'message': 'Ocean data added successfully',
            'data': ocean_data.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/data', methods=['GET'])
@jwt_required()
def get_ocean_data():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 50, type=int)
        
        # Filter parameters
        location = request.args.get('location')
        data_source = request.args.get('data_source')
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        
        query = OceanData.query
        
        if user_id != 1:  # Assuming user_id 1 is admin/system user
            query = query.filter_by(user_id=user_id)
        
        if location:
            query = query.filter(OceanData.location.contains(location))
        
        if data_source:
            query = query.filter_by(data_source=data_source)
        
        if start_date:
            start_datetime = datetime.fromisoformat(start_date)
            query = query.filter(OceanData.timestamp >= start_datetime)
        
        if end_date:
            end_datetime = datetime.fromisoformat(end_date)
            query = query.filter(OceanData.timestamp <= end_datetime)
        
        ocean_data = query.order_by(OceanData.timestamp.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'data': [data.to_dict() for data in ocean_data.items],
            'total': ocean_data.total,
            'pages': ocean_data.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/data/<int:data_id>', methods=['GET'])
@jwt_required()
def get_ocean_data_point(data_id):
    try:
        user_id = get_jwt_identity()
        data_point = OceanData.query.filter_by(id=data_id).first()
        
        if not data_point:
            return jsonify({'error': 'Data point not found'}), 404
        
        if user_id != 1 and data_point.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        return jsonify({
            'data': data_point.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/data/<int:data_id>', methods=['PUT'])
@jwt_required()
def update_ocean_data(data_id):
    try:
        user_id = get_jwt_identity()
        data_point = OceanData.query.filter_by(id=data_id).first()
        
        if not data_point:
            return jsonify({'error': 'Data point not found'}), 404
        
        if user_id != 1 and data_point.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        data = request.get_json()
        
        updatable_fields = [
            'temperature', 'chlorophyll', 'salinity', 
            'current_speed', 'current_direction', 'depth'
        ]
        
        for field in updatable_fields:
            if field in data:
                setattr(data_point, field, data[field])
        
        data_point.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({
            'message': 'Ocean data updated successfully',
            'data': data_point.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/data/<int:data_id>', methods=['DELETE'])
@jwt_required()
def delete_ocean_data(data_id):
    try:
        user_id = get_jwt_identity()
        data_point = OceanData.query.filter_by(id=data_id).first()
        
        if not data_point:
            return jsonify({'error': 'Data point not found'}), 404
        
        if user_id != 1 and data_point.user_id != user_id:
            return jsonify({'error': 'Access denied'}), 403
        
        db.session.delete(data_point)
        db.session.commit()
        
        return jsonify({
            'message': 'Ocean data deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/fetch/noaa', methods=['POST'])
@jwt_required()
def fetch_noaa_data():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('latitude') or not data.get('longitude'):
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        latitude = data['latitude']
        longitude = data['longitude']
        
        # Initialize NOAA service
        noaa_service = NOAAService()
        
        # Fetch data from NOAA
        noaa_data = noaa_service.get_ocean_data(latitude, longitude)
        
        # Save to database
        ocean_data = OceanData(
            user_id=user_id,
            location=f"NOAA Data ({latitude}, {longitude})",
            latitude=latitude,
            longitude=longitude,
            temperature=noaa_data.get('temperature'),
            chlorophyll=noaa_data.get('chlorophyll'),
            salinity=noaa_data.get('salinity'),
            current_speed=noaa_data.get('current_speed'),
            current_direction=noaa_data.get('current_direction'),
            data_source='noaa'
        )
        
        db.session.add(ocean_data)
        db.session.commit()
        
        return jsonify({
            'message': 'NOAA data fetched and saved successfully',
            'data': ocean_data.to_dict(),
            'raw_data': noaa_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/fetch/cicese', methods=['POST'])
@jwt_required()
def fetch_cicese_data():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('latitude') or not data.get('longitude'):
            return jsonify({'error': 'Latitude and longitude are required'}), 400
        
        latitude = data['latitude']
        longitude = data['longitude']
        
        # Initialize CICESE service
        cicese_service = CICESEService()
        
        # Fetch data from CICESE
        cicese_data = cicese_service.get_ocean_data(latitude, longitude)
        
        # Save to database
        ocean_data = OceanData(
            user_id=user_id,
            location=f"CICESE Data ({latitude}, {longitude})",
            latitude=latitude,
            longitude=longitude,
            temperature=cicese_data.get('temperature'),
            chlorophyll=cicese_data.get('chlorophyll'),
            salinity=cicese_data.get('salinity'),
            current_speed=cicese_data.get('current_speed'),
            current_direction=cicese_data.get('current_direction'),
            data_source='cicese'
        )
        
        db.session.add(ocean_data)
        db.session.commit()
        
        return jsonify({
            'message': 'CICESE data fetched and saved successfully',
            'data': ocean_data.to_dict(),
            'raw_data': cicese_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/heatmap', methods=['GET'])
@cache.cached(timeout=300)  # Cache for 5 minutes
def get_ocean_heatmap():
    try:
        # Get recent ocean data for heatmap
        recent_data = OceanData.query.filter(
            OceanData.timestamp >= datetime.utcnow() - timedelta(days=7)
        ).all()
        
        heatmap_data = []
        for data_point in recent_data:
            if data_point.temperature is not None:
                heatmap_data.append({
                    'lat': data_point.latitude,
                    'lng': data_point.longitude,
                    'weight': data_point.temperature,
                    'location': data_point.location
                })
        
        return jsonify({
            'heatmap_data': heatmap_data,
            'total_points': len(heatmap_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@oceanographic_bp.route('/stats', methods=['GET'])
@cache.cached(timeout=3600)  # Cache for 1 hour
def get_ocean_stats():
    try:
        # Get statistics for ocean data
        stats = {
            'total_data_points': OceanData.query.count(),
            'data_sources': {},
            'temperature_stats': {},
            'chlorophyll_stats': {},
            'recent_activity': {}
        }
        
        # Data sources distribution
        from sqlalchemy import func
        sources = db.session.query(
            OceanData.data_source,
            func.count(OceanData.id).label('count')
        ).group_by(OceanData.data_source).all()
        
        for source, count in sources:
            stats['data_sources'][source] = count
        
        # Temperature statistics
        temp_stats = db.session.query(
            func.avg(OceanData.temperature).label('avg'),
            func.min(OceanData.temperature).label('min'),
            func.max(OceanData.temperature).label('max')
        ).filter(OceanData.temperature.isnot(None)).first()
        
        if temp_stats:
            stats['temperature_stats'] = {
                'average': round(temp_stats.avg, 2) if temp_stats.avg else None,
                'minimum': temp_stats.min,
                'maximum': temp_stats.max
            }
        
        # Chlorophyll statistics
        chloro_stats = db.session.query(
            func.avg(OceanData.chlorophyll).label('avg'),
            func.min(OceanData.chlorophyll).label('min'),
            func.max(OceanData.chlorophyll).label('max')
        ).filter(OceanData.chlorophyll.isnot(None)).first()
        
        if chloro_stats:
            stats['chlorophyll_stats'] = {
                'average': round(chloro_stats.avg, 3) if chloro_stats.avg else None,
                'minimum': chloro_stats.min,
                'maximum': chloro_stats.max
            }
        
        # Recent activity (last 24 hours)
        recent_count = OceanData.query.filter(
            OceanData.timestamp >= datetime.utcnow() - timedelta(hours=24)
        ).count()
        
        stats['recent_activity'] = {
            'last_24_hours': recent_count,
            'last_week': OceanData.query.filter(
                OceanData.timestamp >= datetime.utcnow() - timedelta(days=7)
            ).count()
        }
        
        return jsonify(stats), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500