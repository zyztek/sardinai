# SARDIN-AI - Sistema Avanzado de Monitoreo Pesquero

## Tabla de Contenidos

1. [Introducción](#introducción)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Guía de Instalación](#guía-de-instalación)
4. [Configuración](#configuración)
5. [API Documentation](#api-documentation)
6. [Base de Datos](#base-de-datos)
7. [Modelos de Machine Learning](#modelos-de-machine-learning)
8. [Despliegue en Producción](#despliegue-en-producción)
9. [Monitoreo y Mantenimiento](#monitoreo-y-mantenimiento)
10. [Seguridad](#seguridad)
11. [Contribución](#contribución)
12. [Licencia](#licencia)

## Introducción

SARDIN-AI es un sistema avanzado de monitoreo pesquero diseñado para predecir la ubicación de cardúmenes de sardina en la región de Ensenada, B.C., México. El sistema integra datos oceanográficos en tiempo real, modelos de machine learning y una interfaz intuitiva para apoyar la pesca sostenible.

### Características Principales

- **Predicción de Cardúmenes**: Modelos de ML avanzados para predecir la ubicación de sardinas
- **Datos Oceanográficos en Tiempo Real**: Integración con NOAA, CICESE y otras fuentes
- **Monitoreo de Tráfico Marítimo**: Seguimiento de embarcaciones para planificación de rutas
- **Alertas Inteligentes**: Notificaciones basadas en condiciones oceanográficas
- **Interfaz Intuitiva**: Dashboard web y móvil con visualización avanzada
- **Pesca Sostenible**: Herramientas para garantizar la conservación de especies

### Stack Tecnológico

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, MapLibre GL
- **Backend**: Node.js, Express, TypeScript, PostgreSQL
- **Machine Learning**: Python, XGBoost, LightGBM, CatBoost
- **Base de Datos**: PostgreSQL con PostGIS, Redis
- **Contenedores**: Docker, Docker Compose
- **Monitoreo**: Prometheus, Grafana, ELK Stack

## Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   ML Server     │
│   (Next.js)     │◄──►│   (Node.js)     │◄──►│   (Python)      │
│                 │    │                 │    │                 │
│ - Dashboard     │    │ - API REST      │    │ - Modelos ML    │
│ - Mapas         │    │ - Autenticación │    │ - Predicciones  │
│ - Alertas       │    │ - WebSocket     │    │ - Análisis     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Base de Datos                             │
│                                                             │
│ - PostgreSQL (PostGIS)    - Redis (Caché)                │
│ - Datos Oceanográficos    - Sesiones                       │
│ - Usuarios               - Cola de tareas                 │
│ - Predicciones           - Datos en tiempo real           │
└─────────────────────────────────────────────────────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   APIs Externas │    │   Monitoreo     │    │   Almacenamiento │
│                 │    │                 │    │                 │
│ - NOAA          │    │ - Prometheus    │    │ - Archivos      │
│ - CICESE        │    │ - Grafana       │    │ - Imágenes      │
│ - Satélites     │    │ - ELK Stack     │    │ - Logs          │
│ - AIS           │    │ - Health Checks │    │ - Backups       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Guía de Instalación

### Requisitos Previos

- Node.js 18+
- Python 3.9+
- Docker y Docker Compose
- PostgreSQL 14+
- Redis 7+
- Git

### Instalación Local

1. **Clonar el repositorio**
```bash
git clone https://github.com/sardin-ai/sardin-ai.git
cd sardin-ai
```

2. **Instalar dependencias del frontend**
```bash
npm install
```

3. **Instalar dependencias del backend**
```bash
cd backend
npm install
cd ..
```

4. **Instalar dependencias de ML**
```bash
cd ml-model
pip install -r requirements.txt
cd ..
```

5. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

6. **Iniciar base de datos y Redis**
```bash
docker-compose up -d postgres redis
```

7. **Ejecutar migraciones**
```bash
npm run db:migrate
npm run db:seed
```

8. **Iniciar servicios de desarrollo**
```bash
# Terminal 1: Frontend
npm run dev

# Terminal 2: Backend
cd backend
npm run dev

# Terminal 3: ML Server
cd ml-model
python app.py

# Terminal 4: WebSocket
npm run websocket:dev
```

### Instalación con Docker

1. **Clonar el repositorio**
```bash
git clone https://github.com/sardin-ai/sardin-ai.git
cd sardin-ai
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

3. **Construir y levantar servicios**
```bash
docker-compose up -d
```

4. **Verificar estado de los servicios**
```bash
docker-compose ps
docker-compose logs
```

## Configuración

### Variables de Entorno

```bash
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/sardin_ai
REDIS_URL=redis://:password@localhost:6379

# JWT
JWT_SECRET=your-jwt-secret-key
JWT_REFRESH_SECRET=your-jwt-refresh-secret-key

# OAuth2
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# APIs Externas
NOAA_API_KEY=your-noaa-api-key
CICESE_API_KEY=your-cicese-api-key
OPENAI_API_KEY=your-openai-api-key
ZAI_API_KEY=your-zai-api-key

# Mapas
MAPBOX_TOKEN=your-mapbox-token

# Monitoreo
GRAFANA_PASSWORD=your-grafana-password
PGADMIN_EMAIL=your-email@domain.com
PGADMIN_PASSWORD=your-pgadmin-password

# Aplicación
NODE_ENV=development
PORT=3000
API_URL=http://localhost:5001
WS_URL=ws://localhost:5002
```

### Configuración de Base de Datos

El sistema utiliza PostgreSQL con la extensión PostGIS para datos geoespaciales. Las tablas principales incluyen:

- **users**: Usuarios y roles
- **oceanographic_data**: Datos oceanográficos
- **sardine_predictions**: Predicciones de cardúmenes
- **sardine_reports**: Reportes de usuarios
- **vessel_traffic**: Tráfico marítimo
- **alerts**: Alertas del sistema
- **fishing_routes**: Rutas de pesca
- **system_logs**: Logs del sistema

### Configuración de APIs Externas

#### NOAA ERDDAP
```javascript
// Configuración de conexión a NOAA ERDDAP
const noaaConfig = {
  baseUrl: 'https://coastwatch.pfeg.noaa.gov/erddap',
  datasets: {
    temperature: 'erdMHsstd8day',
    chlorophyll: 'erdMH1chlamday',
    currents: 'erdQAcur8day',
    waves: 'erdWavH8day'
  }
};
```

#### CICESE
```javascript
// Configuración de conexión a CICESE
const ciceseConfig = {
  baseUrl: 'https://oceanografia.cicese.mx/api',
  endpoints: {
    temperature: '/data/temperature',
    salinity: '/data/salinity',
    currents: '/data/currents'
  }
};
```

## API Documentation

### Autenticación

La API utiliza JWT para autenticación. Incluye soporte para OAuth2 y MFA.

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "usuario",
  "password": "contraseña",
  "device_info": {
    "device_type": "web",
    "device_id": "unique-device-id"
  }
}
```

#### Registro
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "nuevo_usuario",
  "email": "email@ejemplo.com",
  "password": "contraseña_segura",
  "full_name": "Nombre Completo"
}
```

#### Refresh Token
```http
POST /api/auth/refresh
Authorization: Bearer <refresh_token>
```

### Endpoints Principales

#### Datos Oceanográficos
```http
GET /api/oceanographic/data?bounds=north,south,east,west&start_time=2023-01-01&end_time=2023-12-31
Authorization: Bearer <access_token>
```

#### Predicciones de Cardúmenes
```http
GET /api/predictions/sardine?bounds=north,south,east,west
Authorization: Bearer <access_token>
```

#### Reportes de Sardinas
```http
POST /api/reports/sardine
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "location": {
    "latitude": 31.8667,
    "longitude": -116.6167
  },
  "report_type": "sighting",
  "estimated_quantity": 1000,
  "notes": "Cardumen grande observado"
}
```

#### Tráfico Marítimo
```http
GET /api/vessel/traffic?bounds=north,south,east,west
Authorization: Bearer <access_token>
```

#### Alertas
```http
GET /api/alerts?severity=high&type=weather
Authorization: Bearer <access_token>
```

### WebSocket

El sistema utiliza WebSocket para actualizaciones en tiempo real:

```javascript
const ws = new WebSocket('ws://localhost:5002');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Datos en tiempo real:', data);
};

// Suscribirse a actualizaciones de predicciones
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'predictions',
  bounds: { north: 32.0, south: 31.5, east: -116.5, west: -117.0 }
}));
```

## Base de Datos

### Esquema Principal

```sql
-- Usuarios y autenticación
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(50) UNIQUE,
  email VARCHAR(255) UNIQUE,
  password_hash VARCHAR(255),
  role VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE
);

-- Datos oceanográficos
CREATE TABLE oceanographic_data (
  id UUID PRIMARY KEY,
  location GEOMETRY(POINT, 4326),
  timestamp TIMESTAMP WITH TIME ZONE,
  temperature_surface DECIMAL(5,2),
  salinity DECIMAL(5,2),
  chlorophyll DECIMAL(8,6),
  current_speed DECIMAL(5,2)
);

-- Predicciones de sardinas
CREATE TABLE sardine_predictions (
  id UUID PRIMARY KEY,
  location GEOMETRY(POINT, 4326),
  probability DECIMAL(5,4),
  estimated_density DECIMAL(10,2),
  prediction_model VARCHAR(50),
  expires_at TIMESTAMP WITH TIME ZONE
);
```

### Funciones Avanzadas

El sistema incluye funciones PostgreSQL para análisis geoespacial:

```sql
-- Obtener datos promedio en un radio
SELECT * FROM get_avg_oceanographic_data(
  ST_MakePoint(-116.6167, 31.8667),
  10.0, -- radio en km
  '2023-01-01'::timestamp,
  '2023-12-31'::timestamp
);

-- Obtener predicciones activas en un área
SELECT * FROM get_active_predictions_in_area(
  ST_MakeEnvelope(-117.0, 31.7, -116.5, 32.0, 4326)
);
```

### Políticas de Seguridad

Row Level Security (RLS) está habilitado para proteger datos:

```sql
-- Usuarios solo pueden ver sus propios reportes
CREATE POLICY "Users can view their own reports" ON sardine_reports
    FOR SELECT USING (user_id = current_setting('app.current_user_id')::uuid);
```

## Modelos de Machine Learning

### Arquitectura de Modelos

El sistema utiliza un ensemble de 5 modelos:

1. **XGBoost**: Para clasificación principal
2. **LightGBM**: Para manejo de grandes volúmenes de datos
3. **CatBoost**: Para variables categóricas
4. **Random Forest**: Para robustez y reducción de overfitting
5. **Gradient Boosting**: Para precisión en predicciones

### Entrenamiento de Modelos

```python
# Entrenamiento del ensemble
from ensemble_prediction import SardineEnsemble

# Cargar datos
X_train, y_train = load_training_data()

# Crear y entrenar ensemble
ensemble = SardineEnsemble()
ensemble.fit(X_train, y_train)

# Guardar modelo
ensemble.save_model('sardine_ensemble_v2.pkl')
```

### Predicción en Tiempo Real

```python
# Realizar predicción
prediction = ensemble.predict(oceanographic_data)

# Resultado incluye:
# - Probabilidad de presencia de sardinas
# - Intervalo de confianza
# - Factores influyentes
# - Estimación de densidad
```

### Variables Predictoras

- **Temperatura superficial**: 16-20°C (óptimo para sardinas)
- **Clorofila**: Indicador de productividad biológica
- **Salinidad**: Niveles óptimos para la especie
- **Corrientes oceánicas**: Dirección y velocidad
- **Profundidad**: Hábitat preferido (50-150m)
- **Época del año**: Patrones migratorios
- **Datos históricos**: Presencia previa en la zona

## Despliegue en Producción

### Configuración de Docker

El sistema está containerizado con Docker:

```bash
# Construir imágenes
docker-compose build

# Levantar servicios
docker-compose -f docker-compose.prod.yml up -d

# Verificar estado
docker-compose -f docker-compose.prod.yml ps
```

### Configuración de Nginx

Nginx actúa como reverse proxy y balanceador de carga:

```nginx
upstream backend {
    server backend:5001;
    server backend-backup:5001 backup;
}

server {
    listen 443 ssl;
    server_name sardin-ai.com;

    location /api/ {
        proxy_pass http://backend;
        limit_req zone=api_limit burst=20 nodelay;
    }
}
```

### Monitoreo y Logging

El sistema incluye monitoreo completo:

- **Prometheus**: Recolección de métricas
- **Grafana**: Visualización de dashboards
- **ELK Stack**: Centralización de logs
- **Health Checks**: Monitoreo de salud de servicios

### Escalabilidad

El sistema está diseñado para escalar:

- **Horizontal**: Múltiples instancias de cada servicio
- **Vertical**: Ajuste de recursos por contenedor
- **Base de Datos**: Replicación y sharding
- **Caché**: Redis cluster para alta disponibilidad

## Monitoreo y Mantenimiento

### Métricas Clave

Monitorear estas métricas:

- **API Response Time**: < 500ms promedio
- **Error Rate**: < 1%
- **Uptime**: > 99.9%
- **Memory Usage**: < 80%
- **CPU Usage**: < 70%
- **Database Connections**: < 80% del máximo

### Health Checks

```bash
# Health check general
curl http://localhost:3000/api/health

# Health check de servicios específicos
curl http://localhost:5001/api/health
curl http://localhost:5002/health
```

### Mantenimiento Programado

1. **Limpieza de Logs**: Diariamente
2. **Backups**: Diarios (base de datos), semanales (archivos)
3. **Actualizaciones**: Mensuales (sistema), trimestrales (modelos)
4. **Optimización**: Semanal (base de datos), mensual (rendimiento)

### Troubleshooting Común

#### Problemas de Conexión a Base de Datos
```bash
# Verificar estado de PostgreSQL
docker-compose exec postgres pg_isready

# Revisar logs
docker-compose logs postgres
```

#### Alto Uso de Memoria
```bash
# Identificar procesos con alto consumo
docker stats

# Reiniciar servicio específico
docker-compose restart backend
```

#### Predicciones Lentas
```bash
# Verificar estado del servidor ML
curl http://localhost:5003/health

# Revisar logs del modelo
docker-compose logs ml-server
```

## Seguridad

### Autenticación y Autorización

- **JWT**: Tokens de acceso con expiración
- **OAuth2**: Integración con Google y Microsoft
- **MFA**: Autenticación de dos factores opcional
- **RBAC**: Control de acceso basado en roles

### Seguridad de Red

- **HTTPS**: Certificados SSL/TLS obligatorios
- **CORS**: Políticas restrictivas de origen cruzado
- **Rate Limiting**: Límites de solicitudes por IP
- **Firewall**: Reglas de firewall a nivel de aplicación

### Seguridad de Datos

- **Encriptación**: Datos sensibles encriptados en reposo
- **Hashing**: Contraseñas hasheadas con bcrypt
- **Máscarado**: Datos personales en logs
- **Backups**: Backups encriptados y offsite

### Validaciones

- **Input Validation**: Validación estricta de entradas
- **SQL Injection**: Uso de parámetros en consultas
- **XSS Protection**: Sanitización de contenido
- **CSRF Protection**: Tokens anti-CSRF en formularios

## Contribución

### Flujo de Trabajo

1. **Fork** el repositorio
2. Crear rama `feature/nueva-caracteristica`
3. **Desarrollar** con pruebas unitarias
4. **Hacer commit** de cambios
5. **Push** a la rama
6. Crear **Pull Request**

### Estándares de Código

- **TypeScript**: Tipado estricto
- **ESLint**: Configuración de linting
- **Prettier**: Formato de código consistente
- **Testing**: Cobertura > 80%

### Estructura de Directorios

```
sardin-ai/
├── src/                    # Código fuente
│   ├── app/               # Aplicación Next.js
│   ├── components/        # Componentes React
│   ├── lib/              # Utilidades y servicios
│   └── hooks/            # Hooks personalizados
├── backend/               # Backend Node.js
│   ├── routes/           # Rutas API
│   ├── services/         # Servicios de negocio
│   └── middleware/      # Middleware
├── ml-model/             # Modelos de ML
│   ├── models/           # Modelos entrenados
│   ├── data/             # Datos de entrenamiento
│   └── notebooks/        # Jupyter notebooks
├── prisma/               # Esquema de base de datos
├── docker/               # Configuración Docker
├── monitoring/           # Configuración monitoreo
└── docs/                 # Documentación
```

## Licencia

Este proyecto está licenciado bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

### Soporte

Para soporte técnico:

- **Documentación**: [docs.sardin-ai.com](https://docs.sardin-ai.com)
- **Issues**: [GitHub Issues](https://github.com/sardin-ai/sardin-ai/issues)
- **Email**: [support@sardin-ai.com](mailto:support@sardin-ai.com)
- **Discord**: [Comunidad SARDIN-AI](https://discord.gg/sardin-ai)

---

**SARDIN-AI** - Innovación en monitoreo pesquero sostenible

© 2024 SARDIN-AI. Todos los derechos reservados.