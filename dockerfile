# ---------- Etapa 1: construir el frontend ----------
FROM node:20 AS builder

WORKDIR /app

# Copiamos solo los archivos necesarios para el build
COPY nextjs-dashboard/package*.json ./
RUN npm install

# Copiamos el resto del proyecto
COPY nextjs-dashboard/ ./

# Compilamos el frontend (Next.js)
RUN npm run build

# ---------- Etapa 2: configurar backend + servidor final ----------
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copiar archivos del backend y build del frontend
COPY --from=builder /app/.next ./frontend/.next
COPY --from=builder /app/public ./frontend/public
COPY --from=builder /app/package*.json ./frontend/

# Copiar requisitos Python
COPY nextjs-dashboard/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt || echo "Sin requirements.txt"

# Instalar Node para servir el frontend
RUN apt-get update && apt-get install -y nodejs npm

# Exponer el puerto (Render usa $PORT)
ENV PORT=8000
EXPOSE 8000

# Comando de inicio
# (ajusta main.py o app.py al nombre de tu backend real)
CMD python src/main.py & cd frontend && npm start
