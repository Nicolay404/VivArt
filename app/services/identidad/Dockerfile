# Servicio de identidad de VIVART. Imagen mínima, sin root y con comprobación de salud.
# Contexto de construcción: app/services/identidad
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine
WORKDIR /app
RUN addgroup -S vivart && adduser -S vivart -G vivart && mkdir -p /data && chown vivart:vivart /data
COPY --from=dependencias /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY bin ./bin
USER vivart

# Valores de arranque. Los secretos (SERVICE_KEYS) NO van en la imagen: se pasan al ejecutar.
# Fuera de la demo: NODE_ENV=production y un transporte de correo real.
ENV PORT=3001 \
    HOST=0.0.0.0 \
    DB_FILE=/data/identidad.sqlite \
    MAIL_TRANSPORT=test

VOLUME ["/data"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
