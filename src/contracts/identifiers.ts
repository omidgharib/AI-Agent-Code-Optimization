export type OpaqueId<Name extends string> = string & { readonly __opaque: Name };
export type TenantId = OpaqueId<"TenantId">;
export type WorkspaceId = OpaqueId<"WorkspaceId">;
export type CodeProjectId = OpaqueId<"CodeProjectId">;
export type SeoProjectId = OpaqueId<"SeoProjectId">;
export type EnvironmentId = OpaqueId<"EnvironmentId">;
export type RunId = OpaqueId<"RunId">;
export type JobId = OpaqueId<"JobId">;
