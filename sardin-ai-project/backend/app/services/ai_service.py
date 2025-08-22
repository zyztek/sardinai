import openai
import json
import re
from textblob import TextBlob
from typing import Dict, List, Any
import os

class AIService:
    def __init__(self):
        openai.api_key = os.environ.get('OPENAI_API_KEY')
        
    def analyze_sentiment(self, chat_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Analyze sentiment of chat conversations using TextBlob and OpenAI
        """
        try:
            # Combine all messages for analysis
            combined_text = " ".join([msg.get('content', '') for msg in chat_data if msg.get('content')])
            
            # Basic sentiment analysis with TextBlob
            blob = TextBlob(combined_text)
            sentiment_polarity = blob.sentiment.polarity
            sentiment_subjectivity = blob.sentiment.subjectivity
            
            # Determine sentiment category
            if sentiment_polarity > 0.1:
                sentiment_category = "positive"
            elif sentiment_polarity < -0.1:
                sentiment_category = "negative"
            else:
                sentiment_category = "neutral"
            
            # Enhanced analysis with OpenAI if available
            enhanced_analysis = None
            confidence_score = 0.7
            
            if openai.api_key:
                try:
                    prompt = f"""
                    Analyze the sentiment of this conversation and provide detailed insights:
                    
                    Conversation: {combined_text[:1000]}...
                    
                    Please provide:
                    1. Overall sentiment (positive, negative, neutral)
                    2. Confidence level (0-1)
                    3. Key emotional themes
                    4. Sentiment progression over time
                    """
                    
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {"role": "system", "content": "You are a sentiment analysis expert."},
                            {"role": "user", "content": prompt}
                        ],
                        max_tokens=500,
                        temperature=0.3
                    )
                    
                    enhanced_analysis = response.choices[0].message.content
                    confidence_score = 0.9
                    
                except Exception as e:
                    print(f"OpenAI analysis failed: {e}")
            
            return {
                'sentiment_category': sentiment_category,
                'polarity': sentiment_polarity,
                'subjectivity': sentiment_subjectivity,
                'confidence_score': confidence_score,
                'enhanced_analysis': enhanced_analysis,
                'message_count': len(chat_data)
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'sentiment_category': 'unknown',
                'confidence_score': 0.0
            }
    
    def extract_topics(self, chat_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Extract main topics from chat conversations
        """
        try:
            # Combine all messages for analysis
            combined_text = " ".join([msg.get('content', '') for msg in chat_data if msg.get('content')])
            
            # Basic keyword extraction
            words = re.findall(r'\b[a-zA-Z]{4,}\b', combined_text.lower())
            word_freq = {}
            for word in words:
                word_freq[word] = word_freq.get(word, 0) + 1
            
            # Get top keywords
            top_keywords = sorted(word_freq.items(), key=lambda x: x[1], reverse=True)[:10]
            
            # Enhanced topic extraction with OpenAI if available
            enhanced_topics = None
            confidence_score = 0.6
            
            if openai.api_key:
                try:
                    prompt = f"""
                    Extract the main topics from this conversation and categorize them:
                    
                    Conversation: {combined_text[:1500]}...
                    
                    Please provide:
                    1. Main topics discussed
                    2. Topic categories (e.g., technical, personal, business)
                    3. Key themes and patterns
                    4. Topic importance ranking
                    """
                    
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {"role": "system", "content": "You are a topic analysis expert."},
                            {"role": "user", "content": prompt}
                        ],
                        max_tokens=500,
                        temperature=0.3
                    )
                    
                    enhanced_topics = response.choices[0].message.content
                    confidence_score = 0.85
                    
                except Exception as e:
                    print(f"OpenAI topic extraction failed: {e}")
            
            return {
                'top_keywords': top_keywords,
                'enhanced_topics': enhanced_topics,
                'confidence_score': confidence_score,
                'total_words': len(words),
                'unique_words': len(set(words))
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'top_keywords': [],
                'confidence_score': 0.0
            }
    
    def generate_summary(self, chat_data: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Generate a comprehensive summary of the chat conversation
        """
        try:
            # Basic statistics
            total_messages = len(chat_data)
            total_words = sum(len(msg.get('content', '').split()) for msg in chat_data)
            
            # Extract participants
            participants = list(set(msg.get('author', 'Unknown') for msg in chat_data))
            
            # Time span
            timestamps = [msg.get('timestamp') for msg in chat_data if msg.get('timestamp')]
            time_span = None
            if timestamps:
                time_span = {
                    'start': min(timestamps),
                    'end': max(timestamps)
                }
            
            # Enhanced summary with OpenAI if available
            enhanced_summary = None
            confidence_score = 0.7
            
            if openai.api_key:
                try:
                    # Format conversation for analysis
                    formatted_conversation = []
                    for msg in chat_data[:20]:  # Limit to first 20 messages for API limits
                        author = msg.get('author', 'Unknown')
                        content = msg.get('content', '')
                        formatted_conversation.append(f"{author}: {content}")
                    
                    conversation_text = "\n".join(formatted_conversation)
                    
                    prompt = f"""
                    Generate a comprehensive summary of this conversation:
                    
                    {conversation_text}
                    
                    Please provide:
                    1. Executive summary (2-3 sentences)
                    2. Key points discussed
                    3. Decisions made
                    4. Action items
                    5. Overall conversation tone
                    """
                    
                    response = openai.ChatCompletion.create(
                        model="gpt-3.5-turbo",
                        messages=[
                            {"role": "system", "content": "You are an expert conversation summarizer."},
                            {"role": "user", "content": prompt}
                        ],
                        max_tokens=600,
                        temperature=0.3
                    )
                    
                    enhanced_summary = response.choices[0].message.content
                    confidence_score = 0.9
                    
                except Exception as e:
                    print(f"OpenAI summary generation failed: {e}")
            
            return {
                'total_messages': total_messages,
                'total_words': total_words,
                'participants': participants,
                'time_span': time_span,
                'enhanced_summary': enhanced_summary,
                'confidence_score': confidence_score
            }
            
        except Exception as e:
            return {
                'error': str(e),
                'total_messages': 0,
                'confidence_score': 0.0
            }