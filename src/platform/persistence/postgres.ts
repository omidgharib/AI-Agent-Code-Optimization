import type { PersistencePort, SqlResult } from "./port";
export interface PostgresClient { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount?: number | null }>; release?(): void }
export interface PostgresPool extends PostgresClient { connect(): Promise<PostgresClient> }
const postgresSql = (sql: string) => { let index = 0; return sql.replace(/\?/g, () => `$${++index}`).replace(/INTEGER PRIMARY KEY AUTOINCREMENT/gi, "BIGSERIAL PRIMARY KEY"); };
export class PostgresPersistence implements PersistencePort {
  constructor(private readonly pool: PostgresPool, private readonly transactionClient?: PostgresClient) {}
  private get client(): PostgresClient { return this.transactionClient ?? this.pool; }
  async query<T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> { return (await this.client.query(postgresSql(sql), params)).rows as T[]; }
  async execute(sql: string, params: unknown[] = []): Promise<SqlResult> { const result = await this.client.query(postgresSql(sql), params); return { changes: result.rowCount ?? 0 }; }
  async transaction<T>(work: (database: PersistencePort) => Promise<T>): Promise<T> { if (this.transactionClient) return work(this); const client = await this.pool.connect(); await client.query("BEGIN"); try { const result = await work(new PostgresPersistence(this.pool, client)); await client.query("COMMIT"); return result; } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release?.(); } }
  async close() {}
}
