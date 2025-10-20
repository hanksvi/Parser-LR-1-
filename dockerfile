# Usa Node 20
FROM node:20

# Directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar solo package.json primero (para caching de npm install)
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar todo el código
COPY . .

# Instalar Python
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*

# Variables de entorno
ENV PYTHON_BIN=python3
ENV SCRIPTS_DIR=/app/src
ENV PORT=3000

# Exponer puerto
EXPOSE 3000

# Comando por defecto (lo sobrescribimos con docker-compose para dev/prod)
CMD ["npm", "start"]
