-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('ADMINISTRADOR', 'COORDINACION', 'OPERACION', 'CONSULTA');

-- CreateEnum
CREATE TYPE "coordination_scope" AS ENUM ('GENERAL', 'AREA');

-- CreateEnum
CREATE TYPE "event_status" AS ENUM ('PREPARACION', 'RESPUESTA', 'RECUPERACION', 'CERRADO');

-- CreateEnum
CREATE TYPE "smn_alert" AS ENUM ('SIN_ALERTA', 'AMARILLA', 'NARANJA', 'ROJA');

-- CreateEnum
CREATE TYPE "notice_status" AS ENUM ('RECIBIDO', 'VINCULADO', 'CONVERTIDO', 'DESCARTADO');

-- CreateEnum
CREATE TYPE "priority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('RECIBIDO', 'PRIORIZADO', 'ASIGNADO', 'EN_ATENCION', 'IMPEDIDO', 'RESUELTO', 'CERRADO');

-- CreateEnum
CREATE TYPE "task_status" AS ENUM ('CREADA', 'ASIGNADA', 'ACEPTADA', 'EN_DESPLAZAMIENTO', 'EN_EJECUCION', 'IMPEDIDA', 'RESUELTA', 'VERIFICADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "stay_kind" AS ENUM ('TRANSITORIO', 'PERNOCTA');

-- CreateEnum
CREATE TYPE "occupancy_direction" AS ENUM ('INGRESO', 'EGRESO');

-- CreateEnum
CREATE TYPE "life_risk" AS ENUM ('SI', 'NO', 'DESCONOCIDO');

-- CreateEnum
CREATE TYPE "trend" AS ENUM ('EMPEORA', 'ESTABLE', 'MEJORA', 'DESCONOCIDA');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "user_role" NOT NULL,
    "coordination_scope" "coordination_scope",
    "area_id" TEXT,
    "can_triage" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "event_status" NOT NULL,
    "smn_alert" "smn_alert" NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "opened_by_id" TEXT NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "contact" TEXT,
    "location_text" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "location_pending" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "life_risk" "life_risk" NOT NULL,
    "trend" "trend" NOT NULL,
    "status" "notice_status" NOT NULL DEFAULT 'RECIBIDO',
    "incident_id" TEXT,
    "evidence_filename" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type_code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location_text" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "location_pending" BOOLEAN NOT NULL DEFAULT false,
    "life_risk" "life_risk" NOT NULL,
    "trend" "trend" NOT NULL,
    "priority" "priority",
    "status" "incident_status" NOT NULL DEFAULT 'RECIBIDO',
    "triage_by_id" TEXT,
    "triaged_at" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "closure_notes" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "incident_id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "priority" "priority" NOT NULL,
    "status" "task_status" NOT NULL DEFAULT 'CREADA',
    "area_id" TEXT NOT NULL,
    "area_coordinator_id" TEXT,
    "assignee_id" TEXT,
    "assigned_area_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_person_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "dispatched_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "result_notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" TEXT,
    "impediment_reason" TEXT,
    "impediment_next_action" TEXT,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evacuation_centers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "stay_kind" "stay_kind" NOT NULL,
    "capacity" INTEGER NOT NULL,
    "equipment_notes" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "evacuation_centers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evacuation_occupancy_logs" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "center_id" TEXT NOT NULL,
    "direction" "occupancy_direction" NOT NULL,
    "people_count" INTEGER NOT NULL,
    "occupied_after" INTEGER NOT NULL,
    "notes" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evacuation_occupancy_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "details" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "areas_code_key" ON "areas"("code");

-- CreateIndex
CREATE UNIQUE INDEX "events_code_key" ON "events"("code");

-- CreateIndex
CREATE UNIQUE INDEX "incidents_event_id_code_key" ON "incidents"("event_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_event_id_code_key" ON "tasks"("event_id", "code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_opened_by_id_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_triage_by_id_fkey" FOREIGN KEY ("triage_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_area_coordinator_id_fkey" FOREIGN KEY ("area_coordinator_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evacuation_occupancy_logs" ADD CONSTRAINT "evacuation_occupancy_logs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evacuation_occupancy_logs" ADD CONSTRAINT "evacuation_occupancy_logs_center_id_fkey" FOREIGN KEY ("center_id") REFERENCES "evacuation_centers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evacuation_occupancy_logs" ADD CONSTRAINT "evacuation_occupancy_logs_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
