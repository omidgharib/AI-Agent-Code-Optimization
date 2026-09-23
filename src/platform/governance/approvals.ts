// FILE: src/platform/governance/approvals.ts
import { quorumRule, type RolesDecision } from "./roles";
import type { AuditEvent, AuditLog } from "../audit-log/auditLog";

export interface ApprovalRequest { id: string; actorId: string; tenantId: string; policy: {
  title: string;
  filePaths: string[];
  severity: "low" | "medium" | "high";
  requiresSenior: Array<"security" | "admin">;
  allowActorSelfApproval: boolean;
}; decisions: Array<{ approverId: string; approved: boolean; note?: string; at: Date }>; state: "pending" | "approved" | "rejected"; }
export interface ApprovalDecision { id: string; actorId: string; tenantId: string; approverId: string; approved: boolean; note?: string; at: Date }
export function createApprovalRequest(input: { id: string; actorId: string; tenantId: string; title: string; filePaths: string[]; severity?: "low" | "medium" | "high"; requiresSenior?: Array<"security" | "admin">; allowActorSelfApproval?: boolean }): ApprovalRequest {
  return { id: input.id, actorId: input.actorId, tenantId: input.tenantId, policy: { title: input.title, filePaths: input.filePaths, severity: input.severity ?? "high", requiresSenior: input.requiresSenior ?? ["security"], allowActorSelfApproval: input.allowActorSelfApproval ?? false }, decisions: [], state: "pending" };
}
const APPROVER_ROLES = ["admin", "security", "reviewer"];
export function decideApproval(request: ApprovalRequest, decision: ApprovalDecision, memberRoles: (approverId: string) => string[]): { request: ApprovalRequest; outcome: RolesDecision } {
  if (request.state !== "pending") return { request, outcome: { allowed: false, reasons: ["Approval already finalized"] } };
  const roles = memberRoles(decision.approverId);
  if (!roles.some((role) => APPROVER_ROLES.includes(role))) return { request, outcome: { allowed: false, reasons: [`${decision.approverId} is not an approved approver for this tenant`] } };
  const decisions = [...request.decisions, { approverId: decision.approverId, approved: decision.approved, note: decision.note, at: decision.at }];
  const votes = decisions.filter((d) => d.approved).map((d) => ({ approverId: d.approverId, roles: memberRoles(d.approverId) }));
  let state: ApprovalRequest["state"] = "pending";
  const quorum = quorumRule(request.policy.requiresSenior, votes);
  if (quorum.allowed) state = "approved";
  else if (decisions.some((d) => !d.approved)) state = "rejected";
  return { request: { ...request, decisions, state }, outcome: quorum };
}
export function approvalAuditEvent(request: ApprovalRequest): AuditEvent {
  return { schemaVersion: 1, actorId: request.actorId, action: `approval.${request.state}`, resourceId: request.id, occurredAt: new Date().toISOString(), metadata: { approvers: request.decisions.map((d) => d.approverId), title: request.policy.title } };
}
export async function recordApproval(log: AuditLog, request: ApprovalRequest): Promise<void> { await log.append(approvalAuditEvent(request)); }
export function policyViolations(request: ApprovalRequest, modules: Array<{ ref: string; domain: string }>): Array<{ ref: string; reason: string }> {
  const changed = request.policy.filePaths;
  const owned = new Set(modules.map((m) => m.ref));
  return changed.filter((file) => !owned.has(file)).map((file) => ({ ref: file, reason: "declared change does not match any known module ownership entry" }));
}