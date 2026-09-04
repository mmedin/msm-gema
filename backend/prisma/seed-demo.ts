import { PrismaClient, event_status, smn_alert, notice_status, priority, incident_status, task_status, life_risk, trend } from '@prisma/client';

const prisma = new PrismaClient();

export async function runDemoSeed() {
  console.log('Iniciando carga de datos semilla DEMO/FIXTURE (General San Martín)...');

  // Buscar usuarios y áreas maestras requeridas
  const coordGeneral = await prisma.user.findUnique({ where: { username: 'coord.general' } });
  const defCivil = await prisma.user.findUnique({ where: { username: 'defensa.civil' } });
  const parquesCoord = await prisma.user.findUnique({ where: { username: 'parques.coord' } });
  const higieneCoord = await prisma.user.findUnique({ where: { username: 'higiene.coord' } });

  const parquesArea = await prisma.area.findUnique({ where: { code: 'PARQUES' } });
  const higieneArea = await prisma.area.findUnique({ where: { code: 'HIGIENE_URBANA' } });

  if (!coordGeneral || !defCivil || !parquesCoord || !higieneCoord || !parquesArea || !higieneArea) {
    console.warn('Advertencia: Datos maestros no encontrados. Ejecute seed-master primero.');
    return;
  }

  // 1. Evento Activo Demo
  const eventCode = '2026-001';
  let event = await prisma.event.findUnique({ where: { code: eventCode } });
  if (!event) {
    event = await prisma.event.create({
      data: {
        code: eventCode,
        description: 'Tormenta Severa Santa Rosa con ráfagas y anegamientos',
        status: event_status.RESPUESTA,
        smn_alert: smn_alert.NARANJA,
        opened_by_id: coordGeneral.id,
      },
    });
  }

  // 2. Incidente Demo
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
        triage_by_id: defCivil.id,
        triaged_at: new Date(),
        created_by_id: coordGeneral.id,
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
        area_id: parquesArea.id,
        area_coordinator_id: parquesCoord.id,
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
        area_id: higieneArea.id,
        area_coordinator_id: higieneCoord.id,
        assigned_area_at: new Date(),
        last_activity_at: new Date(),
      },
    });
  }

  // 3. Aviso 1: Villa Ballester (Sin convertir)
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
        created_by_id: coordGeneral.id,
      },
    });
  }

  // 4. Aviso 2: José León Suárez (Convertido en INC-001)
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
        created_by_id: coordGeneral.id,
      },
    });
  }

  console.log('Semilla DEMO completada exitosamente.');
}

if (require.main === module) {
  runDemoSeed()
    .catch((e) => {
      console.error('Error ejecutando seed demo:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
