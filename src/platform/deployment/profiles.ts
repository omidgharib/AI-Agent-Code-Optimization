// FILE: src/platform/deployment/profiles.ts
export type EnvironmentName = "local" | "staging" | "production";
export interface DeploymentProfile { name: EnvironmentName; port: number; persistence: "sqlite" | "postgres"; autoApprove: boolean; require2fa: boolean; telemetryEnabled: boolean; logLevel: string; baseUrl?: string }
export const PROFILES: Record<EnvironmentName, DeploymentProfile> = {
  local: { name: "local", port: 3000, persistence: "sqlite", autoApprove: false, require2fa: false, telemetryEnabled: true, logLevel: "debug" },
  staging: { name: "staging", port: 3100, persistence: "postgres", autoApprove: true, require2fa: false, telemetryEnabled: true, logLevel: "info", baseUrl: "https://staging.example.dev" },
  production: { name: "production", port: 8080, persistence: "postgres", autoApprove: false, require2fa: true, telemetryEnabled: true, logLevel: "warn", baseUrl: "https://auditor.example.com" },
};
export function profileFor(env: EnvironmentName): DeploymentProfile { return PROFILES[env]; }
export function localProfile(overrides: Partial<DeploymentProfile> = {}): DeploymentProfile { return { ...PROFILES.local, ...overrides }; }
export interface LaunchChecklist { profile: DeploymentProfile; checks: Array<{ label: string; passed: boolean; detail?: string }> }
export function launchWith(profile: DeploymentProfile, probe: { canConnectPersistence: boolean; defaultUserExists: boolean; portFree: boolean; productionGate: { approvalsEnabled: boolean; telemetryReachable: boolean } }): LaunchChecklist {
  const checks: LaunchChecklist["checks"] = [
    { label: "persistence reachable", passed: probe.canConnectPersistence, detail: profile.persistence },
    { label: "default user bootstrapped", passed: probe.defaultUserExists },
    { label: "port available", passed: probe.portFree, detail: String(profile.port) },
  ];
  if (profile.name === "production") {
    checks.push({ label: "approvals enabled for production", passed: probe.productionGate.approvalsEnabled, detail: String(profile.autoApprove) });
    checks.push({ label: "telemetry endpoint reachable", passed: probe.productionGate.telemetryReachable });
  } else checks.push({ label: "auto-approve mirrors profile", passed: !profile.autoApprove || profile.name === "staging" });
  return { profile, checks };
}
export function aggregate(checks: LaunchChecklist["checks"]): { ready: boolean; failed: Array<{ label: string }> } { const failed = checks.filter((c) => !c.passed).map(({ label }) => ({ label })); return { ready: failed.length === 0, failed }; }
export function manualApprovalFallback(changedFiles: string[], profile: DeploymentProfile): { needsHuman: boolean; reason?: string } { if (profile.autoApprove) return { needsHuman: false }; return { needsHuman: changedFiles.some((f) => /\.(?:env|pem|key|toml|ya?ml)$/i.test(f)), reason: changedFiles.some((f) => /\.(?:env|pem|key)$/i.test(f)) ? "sensitive file changed (secrets/deployment config)" : undefined }; }