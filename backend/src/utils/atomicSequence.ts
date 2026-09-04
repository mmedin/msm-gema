import { Prisma } from '@prisma/client';

/**
 * Genera el siguiente código correlativo de Evento (YYYY-xxx) de manera atómica
 * utilizando un bloqueo consultivo transaccional de PostgreSQL (pg_advisory_xact_lock).
 */
export async function generateNextEventCode(
  tx: Prisma.TransactionClient,
  year: number
): Promise<string> {
  // pg_advisory_xact_lock asegura que ninguna otra transacción calcule
  // el correlativo para el mismo año al mismo tiempo. Se libera al hacer commit/rollback.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(${year})`;

  const events = await tx.event.findMany({
    where: {
      code: { startsWith: `${year}-` },
    },
    select: { code: true },
  });

  let maxNum = 0;
  const regex = new RegExp(`^${year}-(\\d+)$`);
  for (const ev of events) {
    const match = ev.code.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${year}-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Genera el siguiente código correlativo de Incidente (INC-xxx) de manera atómica
 * dentro de un evento, bloqueando la fila del evento padre con FOR UPDATE.
 */
export async function generateNextIncidentCode(
  tx: Prisma.TransactionClient,
  eventId: string
): Promise<string> {
  // Bloqueo pesimista a nivel de fila sobre el evento padre
  await tx.$executeRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

  const incidents = await tx.incident.findMany({
    where: { event_id: eventId },
    select: { code: true },
  });

  let maxNum = 0;
  for (const inc of incidents) {
    const match = inc.code.match(/^INC-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `INC-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Genera el siguiente código correlativo de Tarea (TAR-xxx) de manera atómica
 * dentro de un evento, bloqueando la fila del evento padre con FOR UPDATE.
 */
export async function generateNextTaskCode(
  tx: Prisma.TransactionClient,
  eventId: string
): Promise<string> {
  // Bloqueo pesimista a nivel de fila sobre el evento padre
  await tx.$executeRaw`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`;

  const tasks = await tx.task.findMany({
    where: { event_id: eventId },
    select: { code: true },
  });

  let maxNum = 0;
  for (const t of tasks) {
    const match = t.code.match(/^TAR-(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `TAR-${String(maxNum + 1).padStart(3, '0')}`;
}

/**
 * Envoltorio para reintentar operaciones transaccionales en caso de conflictos de serialización o colisiones transitorias.
 */
export async function withTransactionRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 100
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      attempt++;
      const isRetryable =
        error?.code === 'P2002' ||
        error?.code === 'P2034' ||
        error?.message?.includes('deadlock') ||
        error?.message?.includes('could not serialize access');

      if (attempt >= maxRetries || !isRetryable) {
        throw error;
      }
      await new Promise((res) => setTimeout(res, delayMs * Math.pow(2, attempt - 1)));
    }
  }
}
