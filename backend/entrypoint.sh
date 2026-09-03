#!/bin/sh
set -e

echo "Iniciando MSM-CRISIS Backend Entrypoint..."

echo "Aplicando esquema de base de datos con Prisma..."
npx prisma db push --accept-data-loss

echo "Ejecutando semilla de datos de General San Martín..."
npx tsx prisma/seed.ts || echo "Aviso: Semilla ya inicializada o omitida."

echo "Iniciando servidor de producción..."
exec node dist/index.js
