FROM node:21-alpine3.18

WORKDIR /app

COPY . .
RUN npm install --production --ignore-scripts

EXPOSE 3000

CMD ["node", "dist/app.js"]# Etapa de construcción
FROM node:21-alpine3.18 as builder

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar los archivos de la aplicación
COPY . .

# Instalar dependencias
RUN npm install

# Instalar TypeScript globalmente
RUN npm install -g typescript

# Compilar el código TypeScript a JavaScript
RUN tsc

# Etapa de despliegue
FROM node:21-alpine3.18

# Establecer el directorio de trabajo
WORKDIR /app

# Copiar los archivos compilados desde la etapa de construcción
COPY --from=builder /app/dist /app/dist

# Copiar los archivos de configuración y dependencias
COPY --from=builder /app/package*.json /app/

# Instalar las dependencias necesarias en la etapa de producción
RUN npm install --production

# Comando para ejecutar la aplicación
CMD ["node", "dist/app.js"]  # Asegúrate de que "app.js" es el archivo correcto en dist

