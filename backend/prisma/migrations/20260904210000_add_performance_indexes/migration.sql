-- CreateIndex
CREATE INDEX "notices_event_id_idx" ON "notices"("event_id");

-- CreateIndex
CREATE INDEX "notices_status_idx" ON "notices"("status");

-- CreateIndex
CREATE INDEX "notices_incident_id_idx" ON "notices"("incident_id");

-- CreateIndex
CREATE INDEX "incidents_event_id_status_idx" ON "incidents"("event_id", "status");

-- CreateIndex
CREATE INDEX "incidents_priority_idx" ON "incidents"("priority");

-- CreateIndex
CREATE INDEX "incidents_last_activity_at_idx" ON "incidents"("last_activity_at");

-- CreateIndex
CREATE INDEX "tasks_event_id_status_idx" ON "tasks"("event_id", "status");

-- CreateIndex
CREATE INDEX "tasks_area_id_idx" ON "tasks"("area_id");

-- CreateIndex
CREATE INDEX "tasks_assignee_id_idx" ON "tasks"("assignee_id");

-- CreateIndex
CREATE INDEX "tasks_priority_idx" ON "tasks"("priority");

-- CreateIndex
CREATE INDEX "tasks_last_activity_at_idx" ON "tasks"("last_activity_at");

-- CreateIndex
CREATE INDEX "evacuation_occupancy_logs_center_id_event_id_created_at_idx" ON "evacuation_occupancy_logs"("center_id", "event_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");
