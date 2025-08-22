# SARDIN-AI - Sistema de Monitoreo Pesquero Avanzado

## 🐟 Descripción del Proyecto

SARDIN-AI es un sistema integral de monitoreo pesquero que combina inteligencia artificial, análisis de datos oceanográficos y predicción de especies para la pesca sostenible de sardinas y otras especies en la región de Ensenada, B.C., México.

## 🚀 Características Principales

### Análisis de Chat con IA
- **Análisis de Sentimiento**: Evaluación emocional de conversaciones
- **Extracción de Temas**: Identificación de temas principales y patrones
- **Generación de Resúmenes**: Creación automática de resúmenes ejecutivos
- **Generación de Informes**: Exportación a PDF y Markdown

### Monitoreo Oceanográfico
- **Datos en Tiempo Real**: Temperatura, clorofila, salinidad, corrientes
- **Integración NOAA**: Acceso a datos satelitales y boyas oceanográficas
- **Integración CICESE**: Datos especializados para la región de Ensenada
- **Mapas Interactivos**: Visualización de datos geoespaciales

### Predicción de Especies
- **Machine Learning**: Modelos predictivos para ubicación de peces
- **Análisis de Factores Ambientales**: Correlación con condiciones oceanográficas
- **Optimización de Rutas**: Planificación eficiente de rutas de pesca
- **Alertas en Tiempo Real**: Notificaciones de alta probabilidad

### Sistema Completo
- **Frontend Moderno**: Next.js/React con TypeScript
- **Backend Robusto**: Flask/Python con API RESTful
- **Base de Datos**: PostgreSQL con PostGIS para datos espaciales
- **Contenedorización**: Docker y Docker Compose
- **Despliegue**: Nginx como reverse proxy

## 📋 Requisitos del Sistema

### Prerrequisitos
- Docker y Docker Compose
- Node.js 18+
- Python 3.9+
- 4GB RAM mínimo
- 20GB espacio en disco

### Puertos Requeridos
- 80: HTTP
- 443: HTTPS
- 3000: Frontend (Next.js)
- 5000: Backend (Flask)
- 5432: PostgreSQL
- 6379: Redis
- 8888: Flower (monitoreo)

## 🛠️ Instalación y Configuración

### 1. Clonar el Repositorio
```bash
git clone <repository-url>
cd sardin-ai-project
```

### 2. Configurar Variables de Entorno
```bash
cp .env.example .env
# Editar .env con tus configuraciones
```

### 3. Construir y Desplegar
```bash
# Para desarrollo
docker-compose up -d

# Para producción
./deploy.sh
```

### 4. Acceder a la Aplicación
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- Monitoreo Celery: http://localhost:8888

## 🔧 Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Database      │
│   Next.js/React │◄──►│   Flask/Python  │◄──►│   PostgreSQL    │
│   TypeScript    │    │   API RESTful   │    │   PostGIS       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Nginx         │    │   Redis         │    │   Servicios     │
│   Reverse Proxy │◄──►│   Cache         │◄──►│   Externos      │
│   SSL/TLS       │    │   Cola          │    │   NOAA/CICESE   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 📊 Módulos Principales

### 1. Módulo de Análisis de Chat
- **Procesamiento NLP**: Análisis de lenguaje natural
- **Detección de Sentimientos**: Clasificación emocional
- **Extracción de Entidades**: Identificación de conceptos clave
- **Generación de Informes**: Automatización de documentación

### 2. Módulo Oceanográfico
- **Adquisición de Datos**: Integración con APIs externas
- **Procesamiento en Tiempo Real**: Streaming de datos
- **Almacenamiento Eficiente**: Base de datos optimizada
- **Visualización Interactiva**: Mapas y gráficos dinámicos

### 3. Módulo de Predicción
- **Machine Learning**: Modelos predictivos con scikit-learn
- **Análisis de Factores**: Correlación ambiental
- **Optimización**: Algoritmos de rutas eficientes
- **Validación**: Verificación de precisión

### 4. Módulo de Reportes
- **Generación Automática**: Creación de informes programada
- **Múltiples Formatos**: PDF, Markdown, HTML
- **Plantillas Personalizables**: Informes adaptativos
- **Distribución**: Envío automático por email/API

## 🔌 Integración de APIs

### APIs Externas
- **NOAA**: Datos oceanográficos y satelitales
- **CICESE**: Investigación marina regional
- **OpenAI**: Procesamiento de lenguaje natural
- **MarineTraffic**: Seguimiento de embarcaciones

### APIs Internas
- **RESTful**: Endpoints para todas las funcionalidades
- **WebSocket**: Comunicación en tiempo real
- **GraphQL**: Consultas flexibles (futuro)
- **WebHooks**: Notificaciones automáticas

## 🗄️ Base de Datos

### Esquema Principal
```sql
-- Usuarios y autenticación
users (id, username, email, password_hash, role)

-- Sesiones de chat
chat_sessions (id, user_id, title, chat_data)

-- Análisis de chat
chat_analysis (id, session_id, analysis_type, result_data)

-- Datos oceanográficos
ocean_data (id, user_id, location, temperature, chlorophyll, geom)

-- Predicciones de especies
fish_predictions (id, user_id, species, probability, geom)

-- Seguimiento de embarcaciones
vessel_tracks (id, mmsi, vessel_name, location, geom)

-- Informes generados
reports (id, user_id, title, content, file_path)
```

### Características Espaciales
- **PostGIS**: Datos geoespaciales optimizados
- **Índices Geográficos**: Búsqueda eficiente por ubicación
- **Consultas Espaciales**: Análisis de proximidad y patrones

## 🚀 Despliegue

### Desarrollo Local
```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Detener servicios
docker-compose down
```

### Producción
```bash
# Ejecutar script de despliegue
./deploy.sh

# O manualmente
docker-compose -f docker-compose.prod.yml up -d
```

### Configuración de Dominio
1. Configurar DNS para apuntar al servidor
2. Generar certificados SSL (Let's Encrypt)
3. Configurar Nginx para el dominio
4. Actualizar variables de entorno

## 🔍 Monitoreo y Mantenimiento

### Salud del Sistema
```bash
# Verificar salud de componentes
python app.py health-check

# Monitorear contenedores
docker-compose ps

# Ver logs específicos
docker-compose logs -f backend
```

### Métricas Clave
- **Rendimiento**: Tiempos de respuesta, uso de CPU/memoria
- **Disponibilidad**: Uptime, health checks
- **Precisión**: Exactitud de predicciones
- **Usuarios**: Actividad, sesiones, informes generados

### Actualizaciones
- **Base de Datos**: Migraciones automáticas
- **Modelos ML**: Reentrenamiento programado
- **Dependencias**: Actualización de seguridad
- **Sistema**: Parches y mejoras

## 🛡️ Seguridad

### Medidas Implementadas
- **Autenticación**: JWT con expiración
- **Autorización**: Roles y permisos granulares
- **Encriptación**: Datos en tránsito y en reposo
- **Validación**: Sanitización de entradas
- **Rate Limiting**: Protección contra abusos

### Mejores Prácticas
- **Políticas de Contraseñas**: Requisitos de complejidad
- **Sesiones**: Tiempo de vida limitado
- **API Keys**: Rotación programada
- **Backups**: Automáticos y cifrados

## 📈 Rendimiento y Optimización

### Optimizaciones
- **Caching**: Redis para consultas frecuentes
- **Base de Datos**: Índices optimizados
- **Frontend**: Lazy loading y code splitting
- **API**: Compresión y minificación

### Métricas de Rendimiento
- **Backend**: <200ms respuesta promedio
- **Frontend**: <3s tiempo de carga
- **Base de Datos**: <50ms consultas
- **Sistema**: 99.9% uptime

## 🤝 Contribuciones

### Flujo de Trabajo
1. Fork del repositorio
2. Crear rama de característica
3. Hacer cambios y pruebas
4. Enviar pull request
5. Revisión y merge

### Estándares de Código
- **Python**: PEP 8, type hints
- **JavaScript**: ESLint, Prettier
- **SQL**: Convenciones de nomenclatura
- **Documentación**: Docstrings y comentarios

## 📄 Licencia

Este proyecto está licenciado bajo la Licencia MIT. Ver el archivo [LICENSE](LICENSE) para más detalles.

## 🙏 Agradecimientos

- **NOAA**: Por los datos oceanográficos
- **CICESE**: Por la investigación marina regional
- **Comunidad Científica**: Por el conocimiento compartido
- **Contribuyentes**: Por el desarrollo y mejoras

## 📞 Contacto

- **Soporte Técnico**: support@sardin-ai.com
- **Cuestiones de Negocio**: info@sardin-ai.com
- **Reporte de Issues**: GitHub Issues
- **Documentación**: docs.sardin-ai.com

---

**SARDIN-AI - Innovación en Monitoreo Pesquero Sostenible** 🐟🌊