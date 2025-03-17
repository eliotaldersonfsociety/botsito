# Etapa de construcción
FROM node:21-alpine3.18 as builder

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar los archivos del proyecto
COPY . .

# Instalar las dependencias
RUN npm install

# Instalar ts-node globalmente
RUN npm install -g ts-node typescript

# Etapa de despliegue
FROM node:21-alpine3.18

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar los archivos del proyecto
COPY --from=builder /app /app

# Instalar las dependencias de producción
RUN npm install --production

# Comando para ejecutar el archivo principal con ts-node
CMD ["ts-node", "src/app.ts"]
