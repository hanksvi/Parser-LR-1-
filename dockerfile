# ============================================
# STAGE 1: Build de Next.js
# ============================================
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de producción de Next.js
RUN npm run build

# ============================================
# STAGE 2: Imagen de producción
# ============================================
FROM node:20-slim

# Instalar Python, pip y Graphviz
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    graphviz \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# ===========================
# PYTHON BACKEND
# ===========================
# Copiar requirements.txt
COPY requirements.txt ./

# Instalar dependencias de Python
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

# Copiar todos los archivos Python
COPY *.py ./
COPY src/ ./src/

# ===========================
# NEXT.JS FRONTEND
# ===========================
# Copiar package.json para producción
COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev

# Copiar build de Next.js desde la etapa anterior
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public

# Copiar archivos de configuración necesarios
COPY next.config.* ./
COPY tsconfig.json ./

# ===========================
# CONFIGURACIÓN
# ===========================
# Variables de entorno para Next.js
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Variables de entorno para Python
ENV PYTHON_BIN=python3
ENV SCRIPTS_DIR=/app/src

# Crear directorio para outputs
RUN mkdir -p /app/out

# Usuario no-root para seguridad (opcional pero recomendado)
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs && \
    chown -R nextjs:nodejs /app

USER nextjs

# Exponer puerto
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/run-script', (r) => {if (r.statusCode !== 200 && r.statusCode !== 404) throw new Error(r.statusCode)})" || exit 1

# Comando de inicio
CMD ["npm", "start"]