import type { ProblemDetails } from "../../contracts";
export interface RouteResult { status: number; body: unknown; headers?: Record<string, string> }
export type RouteHandler = (method: string, pathname: string, input: unknown) => Promise<RouteResult | undefined>;
export function routeProblem(status: number, code: string, title: string, detail?: string): RouteResult { const body: ProblemDetails = { schemaVersion: 1, type: `urn:ai-auditor:problem:${code.toLowerCase()}`, title, status, code, detail }; return { status, body, headers: { "content-type": "application/problem+json; charset=utf-8" } }; }
