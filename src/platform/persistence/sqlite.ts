import { DatabaseSync } from "node:sqlite";
import type { PersistencePort, SqlResult } from "./port";
export class SqlitePersistence implements PersistencePort {
  private readonly database: DatabaseSync;
  constructor(file: string) { this.database = new DatabaseSync(file); this.database.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;"); }
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> { return this.database.prepare(sql).all(...params) as T[]; }
  async execute(sql: string, params: unknown[] = []): Promise<SqlResult> { if (params.length === 0 && /;\s*\S/.test(sql.trim().replace(/;$/, ""))) { this.database.exec(sql); return { changes: 0 }; } const result = this.database.prepare(sql).run(...params); return { changes: Number(result.changes) }; }
  async transaction<T>(work: (database: PersistencePort) => Promise<T>): Promise<T> { this.database.exec("BEGIN IMMEDIATE"); try { const result = await work(this); this.database.exec("COMMIT"); return result; } catch (error) { this.database.exec("ROLLBACK"); throw error; } }
  async close() { this.database.close(); }
}
