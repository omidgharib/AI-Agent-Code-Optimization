import path from "node:path";
import { platformDataRoot } from "../artifacts/paths";
import { SqlitePersistence } from "./sqlite";
import { PostgresPersistence, type PostgresPool } from "./postgres";
import type { PersistencePort } from "./port";
export type DeploymentPersistenceConfig = { mode: "local"; sqliteFile?: string } | { mode: "team"; databaseUrl: string; s3Bucket: string };
export function validatePersistenceConfig(config: DeploymentPersistenceConfig): void { if (config.mode === "team") { if (!config.databaseUrl.startsWith("postgres://") && !config.databaseUrl.startsWith("postgresql://")) throw new Error("Team mode requires PostgreSQL"); if (!config.s3Bucket.trim()) throw new Error("Team mode requires S3-compatible artifact storage"); } }
export function createPersistence(config: DeploymentPersistenceConfig, postgresPool?: PostgresPool): PersistencePort { validatePersistenceConfig(config); if (config.mode === "local") return new SqlitePersistence(path.resolve(config.sqliteFile ?? path.join(platformDataRoot(), "local.db"))); if (!postgresPool) throw new Error("A PostgreSQL pool is required in team mode"); return new PostgresPersistence(postgresPool); }
