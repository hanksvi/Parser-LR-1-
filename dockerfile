# ---------- Etapa 1: construir el frontend ----------
FROM node:20 AS builder

WORKDIR /app

# Copiamos solo los archivos necesarios para el build
COPY package*.json ./
RUN npm install

# Copiamos el resto del proyecto
COPY . ./

# Compilamos el frontend (Next.js)
RUN npm run build

# ---------- Etapa 2: configurar backend + servidor final ----------
FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y curl nodejs npm && rm -rf /var/lib/apt/lists/*

# Copiar los artefactos compilados del frontend
COPY --from=builder /app/.next ./frontend/.next
COPY --from=builder /app/public ./frontend/public
COPY --from=builder /app/package*.json ./frontend/

# Copiar requisitos de Python y scripts
COPY requirements.txt ./requirements.txt
COPY src ./src

# Instalar dependencias Python
RUN pip install --no-cache-dir -r requirements.txt || echo "Sin requirements.txt"

# Exponer el puerto
ENV PORT=8000
EXPOSE 8000


CMD python src/run_all.py & cd frontend && npm start
