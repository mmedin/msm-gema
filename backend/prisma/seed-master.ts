import { PrismaClient, user_role, coordination_scope, stay_kind } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function runMasterSeed() {
  console.log('Iniciando carga de datos semilla MAESTROS (General San Martín)...');

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

  for (const u of usersData) {
    const areaId = u.areaCode ? areaMap.get(u.areaCode) ?? null : null;
    await prisma.user.upsert({
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

  console.log('Semilla MAESTRA completada exitosamente.');
}

if (require.main === module) {
  runMasterSeed()
    .catch((e) => {
      console.error('Error ejecutando seed maestro:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
