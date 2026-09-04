#!/bin/sh
set -e

echo "Iniciando GEMA Backend Entrypoint..."

echo "Aplicando migraciones de base de datos con Prisma..."
npx prisma migrate deploy

echo "Ejecutando semilla de datos de General San Martín..."
node dist/prisma/seed.js || echo "Aviso: Semilla ya inicializada o omitida."

echo "Iniciando servidor de producción..."
exec node dist/index.js
