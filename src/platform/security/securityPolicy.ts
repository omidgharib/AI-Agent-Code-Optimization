import { classifyRepositoryPath, type FileClass, type RepositoryPolicy } from "./repositoryPolicy";

export interface SecurityActor { actorId: string; tenantId: string; roles: string[]; approvalId?: string; }
export interface SecurityDecision { allowed: boolean; code: string; reasons: string[]; requiresApproval: boolean; }
export interface SecurityPolicy {
  repository: RepositoryPolicy;
  authorizeFile(actor: SecurityActor, file: string, operation: "read-model-context" | "preview" | "apply" | "restore"): SecurityDecision;
  authorizeNetwork(profile: "public-web" | "private-network" | "authenticated"): SecurityDecision;
  authorizeProcess(command: string): SecurityDecision;
}

export function createSecurityPolicy(options: { repository?: RepositoryPolicy; allowNetworkProfiles?: Array<"public-web" | "private-network" | "authenticated">; processCommands?: string[] } = {}): SecurityPolicy {
  const repository = options.repository ?? {};
  const network = new Set(options.allowNetworkProfiles ?? ["public-web"]);
  const commands = new Set(options.processCommands ?? ["node", "tsc"]);
  return {
    repository,
    authorizeFile(actor, file, operation) {
      const fileClass: FileClass = classifyRepositoryPath(file, repository);
      if (fileClass === "forbidden") return { allowed: false, code: "FILE_FORBIDDEN", reasons: [`${file} is protected`], requiresApproval: false };
      if (fileClass === "elevated" && (operation !== "apply" || !actor.approvalId || !actor.roles.some((role) => role === "admin" || role === "security"))) return { allowed: false, code: "ELEVATED_APPROVAL_REQUIRED", reasons: [`${file} requires actor-bound elevated approval`], requiresApproval: true };
      return { allowed: true, code: "ALLOW", reasons: [], requiresApproval: false };
    },
    authorizeNetwork(profile) { const allowed = network.has(profile); return { allowed, code: allowed ? "ALLOW" : "NETWORK_PROFILE_DENIED", reasons: allowed ? [] : [`Network profile ${profile} is disabled`], requiresApproval: false }; },
    authorizeProcess(command) { const allowed = commands.has(command); return { allowed, code: allowed ? "ALLOW" : "PROCESS_DENIED", reasons: allowed ? [] : [`Process ${command} is not allowlisted`], requiresApproval: false }; },
  };
}
