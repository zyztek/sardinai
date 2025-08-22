# SARDIN-AI System Dependencies Installation Guide

## Prerequisites

Before deploying SARDIN-AI, ensure you have the following dependencies installed:

### 1. Docker and Docker Compose

#### Linux (Ubuntu/Debian)
```bash
# Update package index
sudo apt update

# Install Docker
sudo apt install docker.io docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Log out and log back in to apply group changes
```

#### macOS
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Docker Desktop via Homebrew
brew install --cask docker
```

#### Windows
1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Install Docker Desktop with WSL 2 integration
3. Start Docker Desktop after installation

### 2. Node.js and npm (for local development)

#### Linux/macOS
```bash
# Using Node Version Manager (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18
```

#### Windows
1. Download Node.js 18 LTS from https://nodejs.org/
2. Run the installer and follow the prompts

### 3. Python 3.9 and pip

#### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install python3.9 python3.9-pip python3.9-venv
```

#### macOS
```bash
brew install python@3.9
```

#### Windows
1. Download Python 3.9 from https://www.python.org/
2. Run the installer and check "Add Python to PATH"

### 4. OpenSSL (for SSL certificate generation)

#### Linux (Ubuntu/Debian)
```bash
sudo apt install openssl
```

#### macOS
```bash
# OpenSSL is usually pre-installed on macOS
```

#### Windows
1. OpenSSL is included with Git for Windows
2. Or download from https://slproweb.com/products/Win32OpenSSL.html

### 5. Git (for version control)

#### Linux (Ubuntu/Debian)
```bash
sudo apt install git
```

#### macOS
```bash
brew install git
```

#### Windows
1. Download Git from https://git-scm.com/
2. Run the installer

## System Requirements

### Minimum Requirements
- **CPU**: 2 cores
- **RAM**: 4GB
- **Storage**: 20GB free space
- **OS**: Linux, macOS, or Windows 10/11

### Recommended Requirements
- **CPU**: 4 cores or more
- **RAM**: 8GB or more
- **Storage**: 50GB free space
- **OS**: Ubuntu 20.04 LTS or later

## Port Configuration

Ensure the following ports are available:

| Port | Service | Description |
|------|---------|-------------|
| 80   | HTTP    | Web interface (redirects to HTTPS) |
| 443  | HTTPS   | Secure web interface |
| 3000 | Frontend| Next.js development server |
| 5000 | Backend | Flask API server |
| 5432 | Database| PostgreSQL |
| 6379 | Cache   | Redis |
| 8888 | Monitor | Flower (Celery monitoring) |

## Firewall Configuration

### Linux (UFW)
```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow database ports (optional, for local development)
sudo ufw allow 5432/tcp
sudo ufw allow 6379/tcp

# Enable firewall
sudo ufw enable
```

### macOS
```bash
# Allow ports in System Preferences > Security & Privacy > Firewall
# Or use command line:
sudo pfctl -f /etc/pf.conf
```

### Windows
1. Open Windows Defender Firewall
2. Go to "Advanced settings"
3. Create new inbound rules for ports 80, 443, 3000, 5000

## Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# Database Configuration
POSTGRES_DB=sardin_ai
POSTGRES_USER=sardin_user
POSTGRES_PASSWORD=your_secure_password

# Backend Configuration
FLASK_ENV=production
SECRET_KEY=your_super_secret_key
JWT_SECRET_KEY=your_jwt_secret_key

# Database URLs
DATABASE_URL=postgresql://sardin_user:your_secure_password@postgres:5432/sardin_ai
REDIS_URL=redis://redis:6379/0

# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key

# AI Services
OPENAI_API_KEY=your_openai_api_key

# External APIs
NOAA_API_KEY=your_noaa_api_key
MARINETRAFFIC_API_KEY=your_marinetraffic_api_key

# Frontend Configuration
NEXT_PUBLIC_API_URL=https://your-domain.com
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Production Configuration
DOMAIN_NAME=your-domain.com
```

## SSL Certificates

### Production (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Development (Self-signed)
The deployment script will generate self-signed certificates automatically.

## Verification

After installation, verify all components are working:

```bash
# Check Docker status
docker --version
docker-compose --version

# Check Node.js version
node --version
npm --version

# Check Python version
python3 --version
pip3 --version

# Check OpenSSL version
openssl version
```

## Troubleshooting

### Docker Issues
```bash
# Restart Docker service
sudo systemctl restart docker

# Check Docker status
sudo systemctl status docker

# Remove all Docker containers
docker container prune -f

# Remove all Docker images
docker image prune -f
```

### Port Conflicts
```bash
# Check which process is using a port
sudo lsof -i :80
sudo lsof -i :443

# Kill the process
sudo kill -9 <PID>
```

### Permission Issues
```bash
# Fix Docker permissions
sudo usermod -aG docker $USER
newgrp docker

# Fix file permissions
sudo chown -R $USER:$USER /path/to/sardin-ai-project
```

## Next Steps

After completing the installation:

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd sardin-ai-project
   ```

2. Copy environment template:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` file with your configuration

4. Run the deployment script:
   ```bash
   # Linux/macOS
   ./deploy.sh
   
   # Windows
   deploy.bat
   ```

5. Access the application at `https://your-domain.com`

For detailed deployment instructions, see the `DEPLOYMENT.md` file.