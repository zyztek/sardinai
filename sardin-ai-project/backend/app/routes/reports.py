from flask import Blueprint, request, jsonify, send_file
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db
from app.models import Report
from app.services.report_service import ReportService
import os
from datetime import datetime

reports_bp = Blueprint('reports', __name__)

@reports_bp.route('/generate', methods=['POST'])
@jwt_required()
def generate_report():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['title', 'report_type', 'content_type']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        title = data['title']
        report_type = data['report_type']  # pdf, markdown
        content_type = data['content_type']  # chat_analysis, oceanographic, fish_prediction, comprehensive
        
        # Initialize report service
        report_service = ReportService()
        
        # Generate report based on content type
        if content_type == 'chat_analysis':
            content = report_service.generate_chat_analysis_report(user_id, data.get('session_id'))
        elif content_type == 'oceanographic':
            content = report_service.generate_oceanographic_report(
                data.get('start_date'), data.get('end_date'), data.get('location')
            )
        elif content_type == 'fish_prediction':
            content = report_service.generate_fish_prediction_report(
                data.get('species'), data.get('start_date'), data.get('end_date')
            )
        elif content_type == 'comprehensive':
            content = report_service.generate_comprehensive_report(
                data.get('start_date'), data.get('end_date'), data.get('location')
            )
        else:
            return jsonify({'error': 'Invalid content type'}), 400
        
        # Generate file based on report type
        if report_type == 'markdown':
            file_path = report_service.save_markdown_report(content, f"report_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            report_content = content
        elif report_type == 'pdf':
            file_path = report_service.generate_pdf_report(content, f"report_{user_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            report_content = None
        else:
            return jsonify({'error': 'Invalid report type'}), 400
        
        # Save report to database
        report = Report(
            user_id=user_id,
            title=title,
            report_type=report_type,
            content=content,
            file_path=file_path
        )
        
        db.session.add(report)
        db.session.commit()
        
        return jsonify({
            'message': 'Report generated successfully',
            'report': report.to_dict(),
            'content': report_content
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/', methods=['GET'])
@jwt_required()
def get_reports():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        report_type = request.args.get('report_type')
        
        query = Report.query.filter_by(user_id=user_id)
        
        if report_type:
            query = query.filter_by(report_type=report_type)
        
        reports = query.order_by(Report.generated_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'reports': [report.to_dict() for report in reports.items],
            'total': reports.total,
            'pages': reports.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/<int:report_id>', methods=['GET'])
@jwt_required()
def get_report(report_id):
    try:
        user_id = get_jwt_identity()
        report = Report.query.filter_by(id=report_id, user_id=user_id).first()
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        return jsonify({
            'report': report.to_dict(),
            'content': report.content if report.report_type == 'markdown' else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/<int:report_id>/download', methods=['GET'])
@jwt_required()
def download_report(report_id):
    try:
        user_id = get_jwt_identity()
        report = Report.query.filter_by(id=report_id, user_id=user_id).first()
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        if not report.file_path or not os.path.exists(report.file_path):
            return jsonify({'error': 'Report file not found'}), 404
        
        # Determine file type and set appropriate headers
        if report.report_type == 'pdf':
            return send_file(
                report.file_path,
                as_attachment=True,
                download_name=f"{report.title}.pdf",
                mimetype='application/pdf'
            )
        elif report.report_type == 'markdown':
            return send_file(
                report.file_path,
                as_attachment=True,
                download_name=f"{report.title}.md",
                mimetype='text/markdown'
            )
        else:
            return jsonify({'error': 'Unsupported report type'}), 400
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/<int:report_id>', methods=['DELETE'])
@jwt_required()
def delete_report(report_id):
    try:
        user_id = get_jwt_identity()
        report = Report.query.filter_by(id=report_id, user_id=user_id).first()
        
        if not report:
            return jsonify({'error': 'Report not found'}), 404
        
        # Delete file if it exists
        if report.file_path and os.path.exists(report.file_path):
            os.remove(report.file_path)
        
        # Delete report from database
        db.session.delete(report)
        db.session.commit()
        
        return jsonify({
            'message': 'Report deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/templates', methods=['GET'])
@jwt_required()
def get_report_templates():
    try:
        templates = [
            {
                'id': 'chat_analysis',
                'name': 'Chat Analysis Report',
                'description': 'Comprehensive analysis of chat conversations with sentiment and topic analysis',
                'required_fields': ['session_id']
            },
            {
                'id': 'oceanographic',
                'name': 'Oceanographic Data Report',
                'description': 'Analysis of oceanographic data including temperature, chlorophyll, and currents',
                'required_fields': ['start_date', 'end_date'],
                'optional_fields': ['location']
            },
            {
                'id': 'fish_prediction',
                'name': 'Fish Prediction Report',
                'description': 'Summary of fish location predictions and accuracy analysis',
                'required_fields': ['species', 'start_date', 'end_date']
            },
            {
                'id': 'comprehensive',
                'name': 'Comprehensive Fisheries Report',
                'description': 'Complete report including oceanographic data, fish predictions, and vessel tracking',
                'required_fields': ['start_date', 'end_date'],
                'optional_fields': ['location']
            }
        ]
        
        return jsonify({
            'templates': templates
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@reports_bp.route('/preview', methods=['POST'])
@jwt_required()
def preview_report():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['template_id', 'parameters']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        template_id = data['template_id']
        parameters = data['parameters']
        
        # Initialize report service
        report_service = ReportService()
        
        # Generate preview based on template
        if template_id == 'chat_analysis':
            preview = report_service.generate_chat_analysis_preview(
                user_id, parameters.get('session_id')
            )
        elif template_id == 'oceanographic':
            preview = report_service.generate_oceanographic_preview(
                parameters.get('start_date'), parameters.get('end_date'), parameters.get('location')
            )
        elif template_id == 'fish_prediction':
            preview = report_service.generate_fish_prediction_preview(
                parameters.get('species'), parameters.get('start_date'), parameters.get('end_date')
            )
        elif template_id == 'comprehensive':
            preview = report_service.generate_comprehensive_preview(
                parameters.get('start_date'), parameters.get('end_date'), parameters.get('location')
            )
        else:
            return jsonify({'error': 'Invalid template ID'}), 400
        
        return jsonify({
            'preview': preview
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500