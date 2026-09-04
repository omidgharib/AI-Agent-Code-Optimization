export interface SqlResult { changes: number }
export interface PersistencePort { query<T extends Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>; execute(sql: string, params?: unknown[]): Promise<SqlResult>; transaction<T>(work: (database: PersistencePort) => Promise<T>): Promise<T>; close(): Promise<void> }
