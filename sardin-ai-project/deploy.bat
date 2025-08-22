@echo off
REM SARDIN-AI Production Deployment Script for Windows

echo 🚀 Starting SARDIN-AI deployment...

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    pause
    exit /b 1
)

REM Create necessary directories
if not exist "ssl" mkdir ssl
if not exist "logs" mkdir logs
if not exist "backups" mkdir backups

REM Copy environment file if it doesn't exist
if not exist ".env" (
    echo 📋 Creating .env file from template...
    copy .env.example .env
    echo ⚠️  Please edit .env file with your configuration before continuing
    echo    Run: notepad .env
    pause
    exit /b 1
)

REM Generate SSL certificates if they don't exist
if not exist "ssl\cert.pem" (
    echo 🔒 Generating self-signed SSL certificates...
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ssl\key.pem -out ssl\cert.pem -subj "/C=MX/ST=BC/L=Ensenada/O=SARDIN-AI/CN=localhost"
)

REM Stop existing containers
echo 🛑 Stopping existing containers...
docker-compose -f docker-compose.prod.yml down --remove-orphans

REM Build new images
echo 🔨 Building new images...
docker-compose -f docker-compose.prod.yml build --no-cache

REM Start services
echo 🚀 Starting services...
docker-compose -f docker-compose.prod.yml up -d

REM Wait for services to start
echo ⏳ Waiting for services to start...
timeout /t 30 /nobreak >nul

REM Health checks
echo 🔍 Running health checks...

curl -f http://localhost:5000/health >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Backend is healthy
) else (
    echo ❌ Backend health check failed
)

curl -f http://localhost:3000 >nul 2>&1
if %errorlevel% equ 0 (
    echo ✅ Frontend is healthy
) else (
    echo ❌ Frontend health check failed
)

echo 📦 Running containers:
docker-compose -f docker-compose.prod.yml ps

echo 🎉 SARDIN-AI deployment completed successfully!
echo 🌐 Access your application at: https://localhost
echo 📊 Flower monitoring (Celery): http://localhost:8888
pause