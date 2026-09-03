export type UserRole = 'ADMINISTRADOR' | 'COORDINACION' | 'OPERACION' | 'CONSULTA';
export type CoordinationScope = 'GENERAL' | 'AREA';
export type EventStatus = 'PREPARACION' | 'RESPUESTA' | 'RECUPERACION' | 'CERRADO';
export type SmnAlert = 'SIN_ALERTA' | 'AMARILLA' | 'NARANJA' | 'ROJA';
export type NoticeStatus = 'RECIBIDO' | 'VINCULADO' | 'CONVERTIDO' | 'DESCARTADO';
export type Priority = 'P1' | 'P2' | 'P3' | 'P4';
export type IncidentStatus = 'RECIBIDO' | 'PRIORIZADO' | 'ASIGNADO' | 'EN_ATENCION' | 'IMPEDIDO' | 'RESUELTO' | 'CERRADO';
export type TaskStatus = 'CREADA' | 'ASIGNADA' | 'ACEPTADA' | 'EN_DESPLAZAMIENTO' | 'EN_EJECUCION' | 'IMPEDIDA' | 'RESUELTA' | 'VERIFICADA' | 'CANCELADA';
export type StayKind = 'TRANSITORIO' | 'PERNOCTA';
export type OccupancyDirection = 'INGRESO' | 'EGRESO';
export type LifeRisk = 'SI' | 'NO' | 'DESCONOCIDO';
export type Trend = 'EMPEORA' | 'ESTABLE' | 'MEJORA' | 'DESCONOCIDA';

export interface Area {
  id: string;
  code: string;
  name: string;
  active: boolean;
}

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  coordination_scope?: CoordinationScope | null;
  area_id?: string | null;
  area?: Area | null;
  can_triage: boolean;
  active?: boolean;
}

export interface Event {
  id: string;
  code: string;
  description: string;
  status: EventStatus;
  smn_alert: SmnAlert;
  opened_at: string;
  closed_at?: string | null;
  opened_by?: { id: string; name: string; username: string };
  _count?: {
    incidents: number;
    notices: number;
    tasks: number;
  };
}

export interface Notice {
  id: string;
  event_id: string;
  received_at: string;
  channel: string;
  source: string;
  contact?: string | null;
  location_text: string;
  lat?: number | null;
  lng?: number | null;
  location_pending: boolean;
  description: string;
  life_risk: LifeRisk;
  trend: Trend;
  status: NoticeStatus;
  incident_id?: string | null;
  evidence_filename?: string | null;
  created_by_id: string;
  created_by?: { id: string; name: string; username: string };
  incident?: {
    id: string;
    code: string;
    title: string;
    priority?: Priority | null;
    status: IncidentStatus;
  } | null;
}

export interface Task {
  id: string;
  code: string;
  incident_id: string;
  event_id: string;
  action: string;
  priority: Priority;
  status: TaskStatus;
  area_id: string;
  area_coordinator_id?: string | null;
  assignee_id?: string | null;
  assigned_area_at: string;
  assigned_person_at?: string | null;
  accepted_at?: string | null;
  dispatched_at?: string | null;
  started_at?: string | null;
  resolved_at?: string | null;
  result_notes?: string | null;
  verified_at?: string | null;
  verified_by_id?: string | null;
  impediment_reason?: string | null;
  impediment_next_action?: string | null;
  last_activity_at: string;
  created_at: string;
  area?: Area;
  area_coordinator?: { id: string; name: string; username: string } | null;
  assignee?: { id: string; name: string; username: string } | null;
  verified_by?: { id: string; name: string; username: string } | null;
  incident?: {
    id: string;
    code: string;
    title: string;
    priority?: Priority | null;
    location_text: string;
    lat?: number | null;
    lng?: number | null;
    status: IncidentStatus;
  };
}

export interface Incident {
  id: string;
  code: string;
  event_id: string;
  title: string;
  type_code: string;
  description: string;
  location_text: string;
  lat?: number | null;
  lng?: number | null;
  location_pending: boolean;
  life_risk: LifeRisk;
  trend: Trend;
  priority?: Priority | null;
  status: IncidentStatus;
  triage_by_id?: string | null;
  triaged_at?: string | null;
  resolution_notes?: string | null;
  closure_notes?: string | null;
  last_activity_at: string;
  created_by_id: string;
  created_at: string;
  created_by?: { id: string; name: string; username: string };
  triage_by?: { id: string; name: string; username: string } | null;
  notices?: Notice[];
  tasks?: Task[];
  _count?: {
    notices: number;
    tasks: number;
  };
}

export interface EvacuationCenter {
  id: string;
  name: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  stay_kind: StayKind;
  capacity: number;
  equipment_notes?: string;
  active: boolean;
  current_occupied?: number;
  available_capacity?: number;
  capacity_exceeded?: boolean;
  percentage?: number;
}

export interface EvacuationOccupancyLog {
  id: string;
  event_id: string;
  center_id: string;
  direction: OccupancyDirection;
  people_count: number;
  occupied_after: number;
  notes?: string | null;
  created_at: string;
  center?: { name: string };
  created_by?: { id: string; name: string; username: string };
}

export interface DashboardStats {
  event: Event;
  metrics: {
    activeP1Count: number;
    activeP2Count: number;
    impededTasksCount: number;
    unassignedTasksCount: number;
    totalIncidents: number;
    totalNotices: number;
    pendingNotices: number;
  };
  evacuation: {
    totalCapacity: number;
    totalOccupied: number;
    availableCapacity: number;
    percentage: number;
  };
  inactivityAlerts: {
    criticalCount: number;
    warningCount: number;
    inactiveP1P2Incidents: Array<{ id: string; code: string; title: string; priority: Priority; last_activity_at: string }>;
    inactiveP1P2Tasks: Array<{ id: string; code: string; action: string; priority: Priority; last_activity_at: string }>;
    inactiveP3P4Incidents: Array<{ id: string; code: string; title: string; priority: Priority; last_activity_at: string }>;
    inactiveP3P4Tasks: Array<{ id: string; code: string; action: string; priority: Priority; last_activity_at: string }>;
  };
  areasBreakdown: Array<{
    id: string;
    code: string;
    name: string;
    total: number;
    pendingDistribution: number;
    inExecution: number;
    resolved: number;
    verified: number;
    impeded: number;
  }>;
  generatedAt: string;
}
