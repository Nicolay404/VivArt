# Servicio de participación de VIVART. Imagen mínima, sin root y con comprobación de salud.
# Contexto de construcción: app/services/participacion
FROM node:24-alpine AS dependencias
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine
WORKDIR /app
RUN addgroup -S vivart && adduser -S vivart -G vivart
COPY --from=dependencias /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER vivart

# Los secretos (DATABASE_URL, IDENTIDAD_SERVICE_KEY, SERVICE_KEYS, TICKET_KEY) NO van en la imagen: se pasan al ejecutar.
ENV PORT=3003 \
    HOST=0.0.0.0

EXPOSE 3003
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3003)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
