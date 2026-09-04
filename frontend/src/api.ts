import {
  User,
  Event,
  Notice,
  Incident,
  Task,
  EvacuationCenter,
  EvacuationOccupancyLog,
  DashboardStats,
  Area,
  Priority,
  IncidentStatus,
  TaskStatus,
} from './types';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function getToken(): string | null {
  return localStorage.getItem('msm_token');
}

export function setToken(token: string) {
  localStorage.setItem('msm_token', token);
}

export function removeToken() {
  localStorage.removeItem('msm_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Si no es FormData, fijar Content-Type a application/json
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    removeToken();
    // No redirigir ni reiniciar si el 401 proviene del propio intento de login
    if (!endpoint.includes('/auth/login')) {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || `Error en la solicitud (${response.status})`;
    const error: any = new Error(errorMsg);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export const api = {
  // Autenticación
  login: (username: string, password: string) =>
    request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getMe: () => request<User>('/auth/me'),

  refreshToken: () =>
    request<{ token: string; user: User }>('/auth/refresh', {
      method: 'POST',
    }),

  // Eventos
  getEvents: () => request<Event[]>('/events'),
  getActiveEvent: () => request<Event>('/events/active'),
  createEvent: (data: Partial<Event>) =>
    request<Event>('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEvent: (id: string, data: Partial<Event>) =>
    request<Event>(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Avisos
  getNotices: (params?: { event_id?: string; status?: string; limit?: number | string; offset?: number; cursor?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<Notice[]>(`/notices${query ? `?${query}` : ''}`);
  },
  createNotice: (formData: FormData) =>
    request<Notice>('/notices', {
      method: 'POST',
      body: formData,
    }),
  convertNotice: (id: string, data: { title?: string; type_code?: string }) =>
    request<{ notice: Notice; incident: Incident }>(`/notices/${id}/convert`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  linkNotice: (id: string, incident_id: string) =>
    request<Notice>(`/notices/${id}/link`, {
      method: 'PATCH',
      body: JSON.stringify({ incident_id }),
    }),
  discardNotice: (id: string) =>
    request<Notice>(`/notices/${id}/discard`, {
      method: 'PATCH',
    }),

  // Incidentes
  getIncidents: (params?: { event_id?: string; status?: string; priority?: string; limit?: number | string; offset?: number; cursor?: string }) => {
    const query = new URLSearchParams(params as any).toString();
    return request<Incident[]>(`/incidents${query ? `?${query}` : ''}`);
  },
  getIncidentById: (id: string) => request<Incident>(`/incidents/${id}`),
  createIncident: (data: Partial<Incident>) =>
    request<Incident>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  triageIncident: (id: string, priority: Priority) =>
    request<Incident>(`/incidents/${id}/triage`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    }),
  updateIncidentStatus: (
    id: string,
    data: { status: IncidentStatus; resolution_notes?: string; closure_notes?: string; force?: boolean }
  ) =>
    request<Incident>(`/incidents/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Tareas
  getTasks: (params?: Record<string, string | boolean | number>) => {
    const query = new URLSearchParams(params as any).toString();
    return request<Task[]>(`/tasks${query ? `?${query}` : ''}`);
  },
  createTask: (data: { incident_id: string; area_id: string; action: string; priority?: Priority }) =>
    request<Task>('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  assignTask: (id: string, assignee_id: string) =>
    request<Task>(`/tasks/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assignee_id }),
    }),
  transitionTask: (
    id: string,
    data: {
      status: TaskStatus;
      result_notes?: string;
      impediment_reason?: string;
      impediment_next_action?: string;
    }
  ) =>
    request<Task>(`/tasks/${id}/transition`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  verifyTask: (id: string) =>
    request<Task>(`/tasks/${id}/verify`, {
      method: 'PATCH',
    }),

  // Centros de evacuados
  getEvacuationCenters: (eventId?: string) => {
    const query = eventId ? `?event_id=${eventId}` : '';
    return request<EvacuationCenter[]>(`/evacuation-centers${query}`);
  },
  recordOccupancy: (
    centerId: string,
    data: { event_id: string; direction: 'INGRESO' | 'EGRESO'; people_count: number; notes?: string }
  ) =>
    request<{ log: EvacuationOccupancyLog; current_occupied: number; capacity_exceeded: boolean }>(
      `/evacuation-centers/${centerId}/occupancy`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
  getOccupancyLogs: (centerId: string, eventId?: string) => {
    const query = eventId ? `?event_id=${eventId}` : '';
    return request<EvacuationOccupancyLog[]>(`/evacuation-centers/${centerId}/logs${query}`);
  },
  createEvacuationCenter: (data: Partial<EvacuationCenter>) =>
    request<EvacuationCenter>('/evacuation-centers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEvacuationCenter: (id: string, data: Partial<EvacuationCenter>) =>
    request<EvacuationCenter>(`/evacuation-centers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  // Dashboard & Corte de Situación
  getDashboardStats: (eventId?: string) => {
    const query = eventId ? `?event_id=${eventId}` : '';
    return request<DashboardStats>(`/dashboard/stats${query}`);
  },
  getDashboardSnapshot: (eventId?: string) => {
    const query = eventId ? `?event_id=${eventId}` : '';
    return request<any>(`/dashboard/snapshot${query}`);
  },

  // Áreas
  getAreas: () => request<Area[]>('/areas'),

  // Usuarios
  getAssignableUsers: (areaId?: string) => {
    const query = areaId ? `?area_id=${areaId}` : '';
    return request<User[]>(`/users/assignable${query}`);
  },
  getUsers: () => request<User[]>('/users'),
  createUser: (data: any) =>
    request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateUser: (id: string, data: any) =>
    request<User>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
};
