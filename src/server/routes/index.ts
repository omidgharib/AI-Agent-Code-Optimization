import type { RouteHandler, RouteResult } from "./types";
export function composeRoutes(...handlers: RouteHandler[]): RouteHandler { return async (method, pathname, input) => { for (const handler of handlers) { const result = await handler(method, pathname, input); if (result) return result; } return undefined; }; }
export type { RouteHandler, RouteResult } from "./types";
