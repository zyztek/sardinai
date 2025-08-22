#!/bin/bash

# Script de despliegue completo para SARDIN-AI
# Este script automatiza todo el proceso de despliegue en producción

set -e  # Detener el script si algún comando falla

# Colores para salida
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para imprimir mensajes con color
print_message() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Función para verificar dependencias
check_dependencies() {
    print_message $BLUE "Verificando dependencias..."
    
    # Verificar Docker
    if ! command_exists docker; then
        print_message $RED "Error: Docker no está instalado"
        exit 1
    fi
    
    # Verificar Docker Compose
    if ! command_exists docker-compose; then
        print_message $RED "Error: Docker Compose no está instalado"
        exit 1
    fi
    
    # Verificar Node.js
    if ! command_exists node; then
        print_message $RED "Error: Node.js no está instalado"
        exit 1
    fi
    
    # Verificar npm
    if ! command_exists npm; then
        print_message $RED "Error: npm no está instalado"
        exit 1
    fi
    
    # Verificar Python
    if ! command_exists python3; then
        print_message $RED "Error: Python 3 no está instalado"
        exit 1
    fi
    
    # Verificar pip
    if ! command_exists pip3; then
        print_message $RED "Error: pip3 no está instalado"
        exit 1
    fi
    
    # Verificar Git
    if ! command_exists git; then
        print_message $RED "Error: Git no está instalado"
        exit 1
    fi
    
    print_message $GREEN "✓ Todas las dependencias están instaladas"
}

# Función para configurar variables de entorno
setup_environment() {
    print_message $BLUE "Configurando variables de entorno..."
    
    if [ ! -f .env ]; then
        print_message $YELLOW "Creando archivo .env desde plantilla..."
        cp .env.example .env
        
        # Generar contraseñas aleatorias
        JWT_SECRET=$(openssl rand -hex 32)
        JWT_REFRESH_SECRET=$(openssl rand -hex 32)
        POSTGRES_PASSWORD=$(openssl rand -hex 16)
        REDIS_PASSWORD=$(openssl rand -hex 16)
        GRAFANA_PASSWORD=$(openssl rand -hex 12)
        PGADMIN_PASSWORD=$(openssl rand -hex 12)
        
        # Reemplazar variables en .env
        sed -i "s/JWT_SECRET=/JWT_SECRET=$JWT_SECRET/" .env
        sed -i "s/JWT_REFRESH_SECRET=/JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET/" .env
        sed -i "s/POSTGRES_PASSWORD=/POSTGRES_PASSWORD=$POSTGRES_PASSWORD/" .env
        sed -i "s/REDIS_PASSWORD=/REDIS_PASSWORD=$REDIS_PASSWORD/" .env
        sed -i "s/GRAFANA_PASSWORD=/GRAFANA_PASSWORD=$GRAFANA_PASSWORD/" .env
        sed -i "s/PGADMIN_PASSWORD=/PGADMIN_PASSWORD=$PGADMIN_PASSWORD/" .env
        
        print_message $GREEN "✓ Archivo .env creado con contraseñas aleatorias"
    else
        print_message $YELLOW "El archivo .env ya existe, omitiendo..."
    fi
    
    # Cargar variables de entorno
    export $(cat .env | xargs)
}

# Función para crear directorios necesarios
setup_directories() {
    print_message $BLUE "Creando directorios necesarios..."
    
    # Directorios de logs
    mkdir -p logs/{nginx,app,ml}
    mkdir -p logs/{frontend,backend,websocket}
    
    # Directorios de datos
    mkdir -p data/{ml,uploads,exports}
    mkdir -p data/{backups,cache,temp}
    
    # Directorios de SSL
    mkdir -p ssl/{certs,private}
    
    # Directorios de monitoreo
    mkdir -p monitoring/{prometheus,grafana,logstash}
    mkdir -p monitoring/{grafana/dashboards,grafana/datasources}
    
    print_message $GREEN "✓ Directorios creados correctamente"
}

# Función para generar certificados SSL (auto-firmados para desarrollo)
setup_ssl() {
    print_message $BLUE "Configurando certificados SSL..."
    
    if [ ! -f ssl/certs/sardin-ai.crt ] || [ ! -f ssl/private/sardin-ai.key ]; then
        print_message $YELLOW "Generando certificados SSL auto-firmados..."
        
        # Generar clave privada
        openssl genrsa -out ssl/private/sardin-ai.key 2048
        
        # Generar CSR
        openssl req -new -key ssl/private/sardin-ai.key -out ssl/private/sardin-ai.csr -subj "/C=MX/ST=Baja California/L=Ensenada/O=SARDIN-AI/CN=sardin-ai.local"
        
        # Generar certificado auto-firmado
        openssl x509 -req -days 365 -in ssl/private/sardin-ai.csr -signkey ssl/private/sardin-ai.key -out ssl/certs/sardin-ai.crt
        
        # Limpiar CSR
        rm ssl/private/sardin-ai.csr
        
        print_message $GREEN "✓ Certificados SSL generados correctamente"
    else
        print_message $YELLOW "Los certificados SSL ya existen, omitiendo..."
    fi
}

# Función para instalar dependencias
install_dependencies() {
    print_message $BLUE "Instalando dependencias..."
    
    # Instalar dependencias del frontend
    print_message $YELLOW "Instalando dependencias del frontend..."
    npm install
    
    # Instalar dependencias del backend
    print_message $YELLOW "Instalando dependencias del backend..."
    cd backend
    npm install
    cd ..
    
    # Instalar dependencias de ML
    print_message $YELLOW "Instalando dependencias de ML..."
    cd ml-model
    pip3 install -r requirements.txt
    cd ..
    
    print_message $GREEN "✓ Dependencias instaladas correctamente"
}

# Función para construir la aplicación
build_application() {
    print_message $BLUE "Construyendo la aplicación..."
    
    # Construir frontend
    print_message $YELLOW "Construyendo frontend..."
    npm run build
    
    # Construir backend
    print_message $YELLOW "Construyendo backend..."
    cd backend
    npm run build
    cd ..
    
    # Construir imágenes Docker
    print_message $YELLOW "Construyendo imágenes Docker..."
    docker-compose build
    
    print_message $GREEN "✓ Aplicación construida correctamente"
}

# Función para configurar la base de datos
setup_database() {
    print_message $BLUE "Configurando base de datos..."
    
    # Iniciar PostgreSQL
    print_message $YELLOW "Iniciando PostgreSQL..."
    docker-compose up -d postgres
    
    # Esperar a que PostgreSQL esté listo
    print_message $YELLOW "Esperando a que PostgreSQL esté listo..."
    sleep 30
    
    # Ejecutar migraciones
    print_message $YELLOW "Ejecutando migraciones..."
    npm run db:migrate
    
    # Ejecutar seed
    print_message $YELLOW "Ejecutando seed..."
    npm run db:seed
    
    print_message $GREEN "✓ Base de datos configurada correctamente"
}

# Función para iniciar servicios
start_services() {
    print_message $BLUE "Iniciando servicios..."
    
    # Iniciar todos los servicios
    docker-compose -f docker-compose.prod.yml up -d
    
    # Esperar a que los servicios estén listos
    print_message $YELLOW "Esperando a que los servicios estén listos..."
    sleep 60
    
    # Verificar estado de los servicios
    print_message $BLUE "Verificando estado de los servicios..."
    docker-compose -f docker-compose.prod.yml ps
    
    print_message $GREEN "✓ Servicios iniciados correctamente"
}

# Función para ejecutar pruebas de salud
health_checks() {
    print_message $BLUE "Ejecutando pruebas de salud..."
    
    # Health check del frontend
    if curl -f http://localhost:3000/api/health > /dev/null 2>&1; then
        print_message $GREEN "✓ Frontend saludable"
    else
        print_message $RED "✗ Frontend no responde"
    fi
    
    # Health check del backend
    if curl -f http://localhost:5001/api/health > /dev/null 2>&1; then
        print_message $GREEN "✓ Backend saludable"
    else
        print_message $RED "✗ Backend no responde"
    fi
    
    # Health check del WebSocket
    if curl -f http://localhost:5002/health > /dev/null 2>&1; then
        print_message $GREEN "✓ WebSocket saludable"
    else
        print_message $RED "✗ WebSocket no responde"
    fi
    
    # Health check del servidor ML
    if curl -f http://localhost:5003/health > /dev/null 2>&1; then
        print_message $GREEN "✓ ML Server saludable"
    else
        print_message $RED "✗ ML Server no responde"
    fi
    
    # Health check de la base de datos
    if docker-compose exec -T postgres pg_isready -U sardin_user -d sardin_ai > /dev/null 2>&1; then
        print_message $GREEN "✓ PostgreSQL saludable"
    else
        print_message $RED "✗ PostgreSQL no responde"
    fi
    
    # Health check de Redis
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        print_message $GREEN "✓ Redis saludable"
    else
        print_message $RED "✗ Redis no responde"
    fi
}

# Función para mostrar información de acceso
show_access_info() {
    print_message $BLUE "Información de acceso:"
    
    echo ""
    print_message $GREEN "=== Frontend ==="
    echo "URL: http://localhost:3000"
    echo "Health Check: http://localhost:3000/api/health"
    
    echo ""
    print_message $GREEN "=== Backend API ==="
    echo "URL: http://localhost:5001"
    echo "Health Check: http://localhost:5001/api/health"
    echo "Documentación: http://localhost:5001/api/docs"
    
    echo ""
    print_message $GREEN "=== WebSocket ==="
    echo "URL: ws://localhost:5002"
    echo "Health Check: http://localhost:5002/health"
    
    echo ""
    print_message $GREEN "=== ML Server ==="
    echo "URL: http://localhost:5003"
    echo "Health Check: http://localhost:5003/health"
    
    echo ""
    print_message $GREEN "=== Monitoreo ==="
    echo "Prometheus: http://localhost:9090"
    echo "Grafana: http://localhost:3001 (admin: ${GRAFANA_PASSWORD})"
    echo "Kibana: http://localhost:5601"
    
    echo ""
    print_message $GREEN "=== Gestión de Base de Datos ==="
    echo "pgAdmin: http://localhost:8080 (${PGADMIN_EMAIL}:${PGADMIN_PASSWORD})"
    echo "Redis Commander: http://localhost:8081"
    
    echo ""
    print_message $GREEN "=== Usuario por Defecto ==="
    echo "Usuario: admin"
    echo "Contraseña: admin123"
    echo "Email: admin@sardin-ai.local"
    
    echo ""
    print_message $YELLOW "=== Comandos Útiles ==="
    echo "Ver logs: docker-compose -f docker-compose.prod.yml logs -f [servicio]"
    echo "Reiniciar: docker-compose -f docker-compose.prod.yml restart [servicio]"
    echo "Detener: docker-compose -f docker-compose.prod.yml down"
    echo "Actualizar: docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d"
}

# Función para mostrar información post-despliegue
show_post_deployment_info() {
    print_message $BLUE "Información post-despliegue:"
    
    echo ""
    print_message $YELLOW "=== Próximos Pasos ==="
    echo "1. Configurar tus propias API keys en el archivo .env"
    echo "2. Actualizar los certificados SSL con certificados reales"
    echo "3. Configurar el dominio personalizado"
    echo "4. Establecer backups automáticos"
    echo "5. Configurar monitoreo y alertas"
    
    echo ""
    print_message $YELLOW "=== Seguridad ==="
    echo "1. Cambiar todas las contraseñas por defecto"
    echo "2. Configurar firewall y restricciones de red"
    echo "3. Habilitar autenticación de dos factores"
    echo "4. Configurar políticas de retención de logs"
    
    echo ""
    print_message $YELLOW "=== Mantenimiento ==="
    echo "1. Monitorear el rendimiento regularmente"
    echo "2. Actualizar dependencias periódicamente"
    echo "3. Realizar backups regulares"
    echo "4. Revisar logs de errores y seguridad"
    
    echo ""
    print_message $GREEN "=== Documentación ==="
    echo "Documentación completa: docs/README.md"
    echo "API Documentation: http://localhost:5001/api/docs"
    echo "Código fuente: https://github.com/sardin-ai/sardin-ai"
}

# Función principal
main() {
    print_message $BLUE "========================================"
    print_message $BLUE "  SARDIN-AI - Script de Despliegue Completo"
    print_message $BLUE "========================================"
    echo ""
    
    # Verificar si se está ejecutando como root
    if [ "$EUID" -eq 0 ]; then
        print_message $RED "No ejecute este script como root"
        exit 1
    fi
    
    # Verificar si Docker está corriendo
    if ! docker info >/dev/null 2>&1; then
        print_message $RED "Docker no está corriendo. Por favor, inicia Docker."
        exit 1
    fi
    
    # Ejecutar pasos de despliegue
    check_dependencies
    setup_environment
    setup_directories
    setup_ssl
    install_dependencies
    build_application
    setup_database
    start_services
    health_checks
    show_access_info
    show_post_deployment_info
    
    echo ""
    print_message $GREEN "========================================"
    print_message $GREEN "  ¡Despliegue completado con éxito!"
    print_message $GREEN "========================================"
    echo ""
}

# Ejecutar función principal
main "$@"