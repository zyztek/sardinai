from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from app import db, cache
from app.models import ChatSession, ChatAnalysis
from app.services.ai_service import AIService
from app.services.report_service import ReportService
import json
from datetime import datetime, timedelta

chat_analysis_bp = Blueprint('chat_analysis', __name__)

@chat_analysis_bp.route('/sessions', methods=['POST'])
@jwt_required()
def create_chat_session():
    try:
        user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data.get('title') or not data.get('chat_data'):
            return jsonify({'error': 'Title and chat data are required'}), 400
        
        session = ChatSession(
            user_id=user_id,
            title=data['title'],
            chat_data=json.dumps(data['chat_data'])
        )
        
        db.session.add(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Chat session created successfully',
            'session': session.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@chat_analysis_bp.route('/sessions', methods=['GET'])
@jwt_required()
def get_chat_sessions():
    try:
        user_id = get_jwt_identity()
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        sessions = ChatSession.query.filter_by(user_id=user_id)\
            .order_by(ChatSession.created_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            'sessions': [session.to_dict() for session in sessions.items],
            'total': sessions.total,
            'pages': sessions.pages,
            'current_page': page
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chat_analysis_bp.route('/sessions/<int:session_id>', methods=['GET'])
@jwt_required()
def get_chat_session(session_id):
    try:
        user_id = get_jwt_identity()
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        return jsonify({
            'session': session.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chat_analysis_bp.route('/sessions/<int:session_id>/analyze', methods=['POST'])
@jwt_required()
def analyze_chat_session(session_id):
    try:
        user_id = get_jwt_identity()
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        data = request.get_json()
        analysis_type = data.get('analysis_type', 'sentiment')
        
        # Parse chat data
        chat_data = json.loads(session.chat_data)
        
        # Initialize AI service
        ai_service = AIService()
        
        # Perform analysis based on type
        if analysis_type == 'sentiment':
            result = ai_service.analyze_sentiment(chat_data)
        elif analysis_type == 'topics':
            result = ai_service.extract_topics(chat_data)
        elif analysis_type == 'summary':
            result = ai_service.generate_summary(chat_data)
        else:
            return jsonify({'error': 'Invalid analysis type'}), 400
        
        # Save analysis result
        analysis = ChatAnalysis(
            chat_session_id=session_id,
            analysis_type=analysis_type,
            result_data=json.dumps(result),
            confidence_score=result.get('confidence_score', 0.0)
        )
        
        db.session.add(analysis)
        db.session.commit()
        
        return jsonify({
            'message': 'Analysis completed successfully',
            'analysis': analysis.to_dict(),
            'result': result
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@chat_analysis_bp.route('/sessions/<int:session_id>/report', methods=['POST'])
@jwt_required()
def generate_chat_report(session_id):
    try:
        user_id = get_jwt_identity()
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        data = request.get_json()
        report_format = data.get('format', 'markdown')
        
        # Get all analyses for this session
        analyses = ChatAnalysis.query.filter_by(chat_session_id=session_id).all()
        
        # Parse chat data and analyses
        chat_data = json.loads(session.chat_data)
        analysis_results = [json.loads(analysis.result_data) for analysis in analyses]
        
        # Generate report
        report_service = ReportService()
        
        if report_format == 'markdown':
            report_content = report_service.generate_markdown_report(
                session.title, chat_data, analysis_results
            )
            file_path = report_service.save_markdown_report(report_content, f"chat_report_{session_id}")
        elif report_format == 'pdf':
            markdown_content = report_service.generate_markdown_report(
                session.title, chat_data, analysis_results
            )
            file_path = report_service.generate_pdf_report(markdown_content, f"chat_report_{session_id}")
        else:
            return jsonify({'error': 'Invalid report format'}), 400
        
        return jsonify({
            'message': 'Report generated successfully',
            'report_format': report_format,
            'file_path': file_path,
            'content': report_content if report_format == 'markdown' else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@chat_analysis_bp.route('/sessions/<int:session_id>', methods=['DELETE'])
@jwt_required()
def delete_chat_session(session_id):
    try:
        user_id = get_jwt_identity()
        session = ChatSession.query.filter_by(id=session_id, user_id=user_id).first()
        
        if not session:
            return jsonify({'error': 'Session not found'}), 404
        
        # Delete associated analyses
        ChatAnalysis.query.filter_by(chat_session_id=session_id).delete()
        
        # Delete session
        db.session.delete(session)
        db.session.commit()
        
        return jsonify({
            'message': 'Chat session deleted successfully'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@chat_analysis_bp.route('/analyses/<int:analysis_id>', methods=['GET'])
@jwt_required()
def get_analysis(analysis_id):
    try:
        user_id = get_jwt_identity()
        analysis = ChatAnalysis.query.join(ChatSession).filter(
            ChatAnalysis.id == analysis_id,
            ChatSession.user_id == user_id
        ).first()
        
        if not analysis:
            return jsonify({'error': 'Analysis not found'}), 404
        
        return jsonify({
            'analysis': analysis.to_dict(),
            'result': json.loads(analysis.result_data)
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500