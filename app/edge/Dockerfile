# Entrada HTTP común de VIVART: sirve la web y enruta por prefijo. Sin dependencias.
# Contexto de construcción: app/  (necesita web/ y edge/)
FROM node:24-alpine
WORKDIR /app
RUN addgroup -S vivart && adduser -S vivart -G vivart
COPY edge/server.js ./edge/server.js
COPY web ./web
USER vivart

ENV PORT=8080 \
    HOST=0.0.0.0 \
    IDENTIDAD_URL=http://identidad:3001 \
    PROGRAMACION_URL=http://programacion:3002

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=3s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "edge/server.js"]
