export interface AuditEvent { schemaVersion: 1; actorId: string; action: string; resourceId: string; occurredAt: string; metadata?: Record<string, unknown> }
export interface AuditLog { append(event: AuditEvent): Promise<void> }
