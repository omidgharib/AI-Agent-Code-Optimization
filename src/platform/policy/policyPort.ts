export interface PolicyDecision { allowed: boolean; reasons: string[] }
export interface PolicyPort { authorize(action: string, resourceId: string): Promise<PolicyDecision> }
