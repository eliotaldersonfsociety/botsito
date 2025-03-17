# Utiliza la imagen base de Node.js con Alpine
FROM node:21-alpine3.18

# Instalar Git para poder clonar repositorios durante la instalación de dependencias
RUN apk add --no-cache git

# Establecer el directorio de trabajo en el contenedor
WORKDIR /app

# Copiar los archivos necesarios del proyecto al contenedor
COPY . .

# Instalar las dependencias necesarias
RUN npm cache clean --force && pnpm install --production --ignore-scripts \
    && addgroup -g 1001 -S nodejs && adduser -S -u 1001 nodejs \
    && rm -rf /usr/local/bin/.npm /usr/local/bin/.node-gyp

# Copiar los archivos de producción al contenedor
COPY --from=builder /app/assets ./assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/*.json /app/*-lock.yaml ./ 

# Configurar el puerto que el contenedor va a exponer
EXPOSE 3000

# Comando para ejecutar el contenedor
CMD ["node", "dist/app.js"]
