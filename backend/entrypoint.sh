#!/bin/sh
set -e

echo "Iniciando GEMA Backend Entrypoint..."

echo "Aplicando migraciones de base de datos con Prisma..."
npx prisma migrate deploy

echo "Ejecutando semilla de datos maestros de General San Martín..."
node dist/prisma/seed-master.js || echo "Aviso: Semilla maestra ya inicializada o omitida."

if [ "$SEED_DEMO" = "true" ] || [ "$NODE_ENV" != "production" ]; then
  echo "Ejecutando semilla de datos de prueba/demo..."
  node dist/prisma/seed-demo.js || echo "Aviso: Semilla demo ya inicializada o omitida."
fi

echo "Iniciando servidor de producción..."
exec node dist/index.js
