import { PrismaClient, user_role, coordination_scope, event_status, smn_alert, notice_status, priority, incident_status, task_status, stay_kind, life_risk, trend } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando carga de datos semilla (General San Martín)...');

  const passwordHash = await bcrypt.hash('crisis2026', 10);

  // 1. Áreas
  const areasData = [
    { code: 'DEFENSA_CIVIL', name: 'Defensa Civil San Martín' },
    { code: 'HIGIENE_URBANA', name: 'Higiene Urbana y Servicios Públicos' },
    { code: 'PARQUES', name: 'Parques y Espacios Verdes' },
    { code: 'TRANSITO', name: 'Tránsito y Seguridad Vial' },
    { code: 'POLITICA_SOCIAL', name: 'Desarrollo Social y Refugios' },
  ];

  const areaMap = new Map<string, string>();
  for (const a of areasData) {
    const area = await prisma.area.upsert({
      where: { code: a.code },
      update: { name: a.name },
      create: { code: a.code, name: a.name },
    });
    areaMap.set(a.code, area.id);
  }

  // 2. Usuarios
  const usersData = [
    {
      username: 'admin.general',
      name: 'Administrador General',
      role: user_role.ADMINISTRADOR,
      scope: null,
      areaCode: null,
      canTriage: false,
    },
    {
      username: 'coord.general',
      name: 'Coordinador General Crisis',
      role: user_role.COORDINACION,
      scope: coordination_scope.GENERAL,
      areaCode: null,
      canTriage: false,
    },
    {
      username: 'defensa.civil',
      name: 'Director Defensa Civil',
      role: user_role.COORDINACION,
      scope: coordination_scope.AREA,
      areaCode: 'DEFENSA_CIVIL',
      canTriage: true,
    },
    {
      username: 'parques.coord',
      name: 'Coordinador Espacios Verdes',
      role: user_role.COORDINACION,
      scope: coordination_scope.AREA,
      areaCode: 'PARQUES',
      canTriage: false,
    },
    {
      username: 'parques.oper',
      name: 'Operador Cuadrilla Parques 1',
      role: user_role.OPERACION,
      scope: null,
      areaCode: 'PARQUES',
      canTriage: false,
    },
    {
      username: 'higiene.coord',
      name: 'Coordinador Higiene Urbana',
      role: user_role.COORDINACION,
      scope: coordination_scope.AREA,
      areaCode: 'HIGIENE_URBANA',
      canTriage: false,
    },
    {
      username: 'higiene.oper',
      name: 'Operador Cuadrilla Limpieza 1',
      role: user_role.OPERACION,
      scope: null,
      areaCode: 'HIGIENE_URBANA',
      canTriage: false,
    },
    {
      username: 'intendencia',
      name: 'Observatorio Intendencia',
      role: user_role.CONSULTA,
      scope: null,
      areaCode: null,
      canTriage: false,
    },
  ];

  const userMap = new Map<string, string>();
  for (const u of usersData) {
    const areaId = u.areaCode ? areaMap.get(u.areaCode) ?? null : null;
    const user = await prisma.user.upsert({
      where: { username: u.username },
      update: {
        name: u.name,
        role: u.role,
        coordination_scope: u.scope,
        area_id: areaId,
        can_triage: u.canTriage,
      },
      create: {
        username: u.username,
        password_hash: passwordHash,
        name: u.name,
        role: u.role,
        coordination_scope: u.scope,
        area_id: areaId,
        can_triage: u.canTriage,
      },
    });
    userMap.set(u.username, user.id);
  }

  // 3. Centros de Evacuados
  const sheltersData = [
    {
      name: 'CEMEF',
      address: 'Sáenz Peña S/N, B1653 José León Suárez',
      lat: -34.5474555,
      lng: -58.5802246,
      stay_kind: stay_kind.PERNOCTA,
      capacity: 150,
      equipment_notes: 'Camas, duchas calientes, cocina comunitaria, grupo electrógeno',
    },
    {
      name: 'Centro de Oportunidades para la Inclusión',
      address: 'Gral. N. Manuel Savio 2500, B1650 Villa Maipú',
      lat: -34.5747796,
      lng: -58.5219259,
      stay_kind: stay_kind.PERNOCTA,
      capacity: 80,
      equipment_notes: 'Accesibilidad motriz, sector familias, sanitarios adaptados',
    },
    {
      name: 'Club Deportivo San Andrés',
      address: 'Int. Casares 2845, B1653 San Andrés',
      lat: -34.558994,
      lng: -58.5445931,
      stay_kind: stay_kind.TRANSITORIO,
      capacity: 60,
      equipment_notes: 'Gimnasio techado, vestuarios, espacio para viandas calientes',
    },
    {
      name: 'Sociedad de Fomento Ciclón Fortín',
      address: 'Pergamino 1551, B1650 Villa Lynch',
      lat: -34.5876698,
      lng: -58.5398042,
      stay_kind: stay_kind.TRANSITORIO,
      capacity: 50,
      equipment_notes: 'Salón principal, sanitarios, punto de distribución de agua y abrigo',
    },
  ];

  for (const s of sheltersData) {
    const existing = await prisma.evacuationCenter.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.evacuationCenter.create({ data: s });
    }
  }

  // 4. Evento Activo
  const coordGeneralId = userMap.get('coord.general')!;
  const eventCode = '2026-001';
  let event = await prisma.event.findUnique({ where: { code: eventCode } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        code: eventCode,
        description: 'Tormenta Severa Santa Rosa con ráfagas y anegamientos',
        status: event_status.RESPUESTA,
        smn_alert: smn_alert.NARANJA,
        opened_by_id: coordGeneralId,
      },
    });
  }

  // 5. Casos de prueba iniciales
  const defCivilId = userMap.get('defensa.civil')!;
  const parquesCoordId = userMap.get('parques.coord')!;
  const higieneCoordId = userMap.get('higiene.coord')!;
  const parquesAreaId = areaMap.get('PARQUES')!;
  const higieneAreaId = areaMap.get('HIGIENE_URBANA')!;

  // Incidente 1
  let incident = await prisma.incident.findFirst({
    where: { event_id: event.id, code: 'INC-001' },
  });

  if (!incident) {
    incident = await prisma.incident.create({
      data: {
        code: 'INC-001',
        event_id: event.id,
        title: 'Anegamiento severo y caída de árbol sobre tendido eléctrico',
        type_code: 'INUNDACION_ANEGAMIENTO',
        description: 'Árbol de gran porte desprendido sobre tendido y vereda con agua ingresando a propiedades.',
        location_text: 'Av. Brigadier Juan Manuel de Rosas y Calle 4, José León Suárez',
        lat: -34.5381,
        lng: -58.5794,
        location_pending: false,
        life_risk: life_risk.SI,
        trend: trend.EMPEORA,
        priority: priority.P1,
        status: incident_status.ASIGNADO,
        triage_by_id: defCivilId,
        triaged_at: new Date(),
        created_by_id: coordGeneralId,
        last_activity_at: new Date(),
      },
    });

    // Tarea 1: Parques
    await prisma.task.create({
      data: {
        code: 'TAR-001',
        incident_id: incident.id,
        event_id: event.id,
        action: 'Retiro y trozado de árbol caído sobre calzada y despeje de cables',
        priority: priority.P1,
        status: task_status.ASIGNADA,
        area_id: parquesAreaId,
        area_coordinator_id: parquesCoordId,
        assigned_area_at: new Date(),
        last_activity_at: new Date(),
      },
    });

    // Tarea 2: Higiene Urbana
    await prisma.task.create({
      data: {
        code: 'TAR-002',
        incident_id: incident.id,
        event_id: event.id,
        action: 'Desobstrucción de sumideros y bombeo de agua acumulada',
        priority: priority.P1,
        status: task_status.ASIGNADA,
        area_id: higieneAreaId,
        area_coordinator_id: higieneCoordId,
        assigned_area_at: new Date(),
        last_activity_at: new Date(),
      },
    });
  }

  // Aviso 1: Villa Ballester (Sin convertir aún)
  const existingNotice1 = await prisma.notice.findFirst({
    where: { event_id: event.id, location_text: { contains: 'Alvear' } },
  });
  if (!existingNotice1) {
    await prisma.notice.create({
      data: {
        event_id: event.id,
        channel: 'LINEA_103',
        source: 'Vecino de Villa Ballester',
        contact: '11-4567-8901',
        location_text: 'Alvear y Lavalle, Villa Ballester',
        lat: -34.5492,
        lng: -58.5543,
        location_pending: false,
        description: 'Acumulación de agua de calzada a vereda por sumidero obstruido por basura.',
        life_risk: life_risk.NO,
        trend: trend.EMPEORA,
        status: notice_status.RECIBIDO,
        created_by_id: coordGeneralId,
      },
    });
  }

  // Aviso 2: José León Suárez (Convertido en INC-001)
  const existingNotice2 = await prisma.notice.findFirst({
    where: { event_id: event.id, location_text: { contains: 'Calle 4' } },
  });
  if (!existingNotice2) {
    await prisma.notice.create({
      data: {
        event_id: event.id,
        channel: 'CAV_147',
        source: 'Operador CAV',
        contact: 'Interno 147',
        location_text: 'Av. Brigadier Juan Manuel de Rosas y Calle 4, José León Suárez',
        lat: -34.5381,
        lng: -58.5794,
        location_pending: false,
        description: 'Rama de gran porte sobre tendido eléctrico, chisporroteo y agua subiendo.',
        life_risk: life_risk.SI,
        trend: trend.EMPEORA,
        status: notice_status.CONVERTIDO,
        incident_id: incident.id,
        created_by_id: coordGeneralId,
      },
    });
  }

  console.log('Semilla completada exitosamente.');
}

main()
  .catch((e) => {
    console.error('Error ejecutando seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
