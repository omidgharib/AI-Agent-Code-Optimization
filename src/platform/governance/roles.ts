// FILE: src/platform/governance/roles.ts
export type TenantRole = "viewer" | "developer" | "reviewer" | "security" | "admin";
export type PermissionId = "audit:run" | "audit:read" | "fix:propose" | "fix:apply" | "fix:restore" | "policy:manage" | "approve" | "secrets:read" | "platform:admin";
export const ROLE_PERMISSIONS: Partial<Record<TenantRole, PermissionId[]>> = {
  viewer: ["audit:read"],
  developer: ["audit:run", "audit:read", "fix:propose", "fix:apply"],
  reviewer: ["audit:read", "fix:propose", "fix:restore", "approve"],
  security: ["audit:read", "fix:propose", "approve", "secrets:read"],
  admin: ["audit:run", "audit:read", "fix:propose", "fix:apply", "fix:restore", "policy:manage", "approve", "secrets:read", "platform:admin"],
};
export interface Member { actorId: string; tenantId: string; role: TenantRole }
export interface RolesDecision { allowed: boolean; reasons: string[] }
export function rolesFor(members: Member[], actorId: string, tenantId: string): TenantRole[] { const role = members.find((m) => m.actorId === actorId && m.tenantId === tenantId)?.role; return role ? [role] : []; }
export function hasPermission(members: Member[], actorId: string, tenantId: string, permission: PermissionId): boolean { return rolesFor(members, actorId, tenantId).some((role) => (ROLE_PERMISSIONS[role] ?? []).includes(permission)); }
export function canApprove(members: Member[], actorId: string, tenantId: string): boolean { return hasPermission(members, actorId, tenantId, "approve"); }
export function requiresApprover(members: Member[], actorId: string, tenantId: string, severity: "high" | "medium" | "low" = "high"): boolean { if (severity === "low") return false; const role = rolesFor(members, actorId, tenantId)[0]; return !role || role === "viewer" || role === "developer"; }
export function authorizeChange(members: Member[], actor: { actorId: string; tenantId: string }, permission: PermissionId): RolesDecision {
  const allowed = hasPermission(members, actor.actorId, actor.tenantId, permission);
  return { allowed, reasons: allowed ? [] : [`${actor.actorId} lacks ${permission}`] };
}
export interface ApprovalVote { approverId: string; roles: string[] }
export function quorumRule(required: Array<"security" | "admin">, approvals: ApprovalVote[], minCount = 2): RolesDecision {
  const senior = new Set<string>(required);
  const seniorApproved = approvals.some((vote) => vote.roles.some((role) => senior.has(role)));
  const ok = approvals.length >= minCount && seniorApproved;
  return { allowed: ok, reasons: ok ? [] : [`Approval quorum not met; need at least ${minCount} approvers with one from ${Array.from(senior).join(" or ")}`] };
}