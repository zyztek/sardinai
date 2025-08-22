#!/bin/bash

# SARDIN-AI Production Deployment Script
# This script automates the deployment of the SARDIN-AI system

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="sardin-ai"
DOMAIN_NAME=${DOMAIN_NAME:-"localhost"}
ENVIRONMENT=${ENVIRONMENT:-"production"}

echo -e "${GREEN}🚀 Starting SARDIN-AI deployment...${NC}"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${YELLOW}📁 Creating necessary directories...${NC}"
mkdir -p ssl logs backups

# Copy environment file if it doesn't exist
if [ ! -f .env ]; then
    echo -e "${YELLOW}📋 Creating .env file from template...${NC}"
    cp .env.example .env
    echo -e "${RED}⚠️  Please edit .env file with your configuration before continuing${NC}"
    echo -e "${RED}   Run: nano .env${NC}"
    exit 1
fi

# Generate SSL certificates if they don't exist (self-signed for development)
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo -e "${YELLOW}🔒 Generating self-signed SSL certificates...${NC}"
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -subj "/C=MX/ST=BC/L=Ensenada/O=SARDIN-AI/CN=${DOMAIN_NAME}"
fi

# Create production nginx configuration
echo -e "${YELLOW}⚙️  Creating production nginx configuration...${NC}"
cat > nginx.prod.conf << EOF
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:5000;
    }

    upstream frontend {
        server frontend:3000;
    }

    # Rate limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=login:10m rate=5r/m;

    server {
        listen 80;
        server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};

        # Redirect to HTTPS
        return 301 https://\$server_name\$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name ${DOMAIN_NAME} www.${DOMAIN_NAME};
        
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        
        ssl_session_cache shared:SSL:1m;
        ssl_session_timeout 5m;
        ssl_ciphers HIGH:!aNULL:!MD5;
        ssl_prefer_server_ciphers on;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
        add_header Referrer-Policy "strict-origin-when-cross-origin" always;
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Gzip compression
        gzip on;
        gzip_vary on;
        gzip_min_length 1024;
        gzip_proxied expired no-cache no-store private must-revalidate max-age=0 auth;
        gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

        # Frontend routes
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade \$http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # Backend API routes with rate limiting
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
            
            # Timeouts
            proxy_connect_timeout 30s;
            proxy_send_timeout 30s;
            proxy_read_timeout 30s;
        }

        # Special rate limiting for auth endpoints
        location /api/auth/ {
            limit_req zone=login burst=10 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Health check endpoints
        location /health {
            proxy_pass http://backend/health;
            proxy_set_header Host \$host;
        }

        # Static files
        location /static/ {
            alias /app/static/;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }

        # Media files
        location /media/ {
            alias /app/media/;
            expires 1y;
            add_header Cache-Control "public";
        }

        # Security: Block access to hidden files
        location ~ /\. {
            deny all;
            return 404;
        }

        # Security: Block access to backup files
        location ~ ~\$ {
            deny all;
            return 404;
        }

        # Large file upload handling
        client_max_body_size 100M;
        client_body_timeout 300s;
        
        # Error pages
        error_page 404 /404.html;
        error_page 500 502 503 504 /50x.html;
        
        location = /50x.html {
            root /usr/share/nginx/html;
        }
    }
}
EOF

# Stop existing containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose -f docker-compose.prod.yml down --remove-orphans

# Pull latest images
echo -e "${YELLOW}📥 Pulling latest images...${NC}"
docker-compose -f docker-compose.prod.yml pull

# Build new images
echo -e "${YELLOW}🔨 Building new images...${NC}"
docker-compose -f docker-compose.prod.yml build --no-cache

# Start services
echo -e "${YELLOW}🚀 Starting services...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 30

# Run database migrations
echo -e "${YELLOW}🗄️  Running database migrations...${NC}"
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U sardin_user -d sardin_ai -c "SELECT version();"

# Health checks
echo -e "${YELLOW}🔍 Running health checks...${NC}"

# Check backend health
if curl -f http://localhost:5000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Backend is healthy${NC}"
else
    echo -e "${RED}❌ Backend health check failed${NC}"
fi

# Check frontend health
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Frontend is healthy${NC}"
else
    echo -e "${RED}❌ Frontend health check failed${NC}"
fi

# Check database health
if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U sardin_user -d sardin_ai > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Database is healthy${NC}"
else
    echo -e "${RED}❌ Database health check failed${NC}"
fi

# Show running containers
echo -e "${YELLOW}📦 Running containers:${NC}"
docker-compose -f docker-compose.prod.yml ps

echo -e "${GREEN}🎉 SARDIN-AI deployment completed successfully!${NC}"
echo -e "${GREEN}🌐 Access your application at: https://${DOMAIN_NAME}${NC}"
echo -e "${YELLOW}📊 Flower monitoring (Celery): http://localhost:8888${NC}"
echo -e "${YELLOW}📋 View logs with: docker-compose -f docker-compose.prod.yml logs -f [service-name]${NC}"