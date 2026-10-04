import { prisma } from "@/lib/prisma";

/** Records a staff action in the audit log (shown on Dashboard → Audit Logs). */
export function logAudit(action: string, entityType: string, entityId: number, userId: number) {
  return prisma.auditLog.create({ data: { action, entityType, entityId, userId } });
}
