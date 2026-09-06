export type RenderStateName = "raw" | "rendered" | "interactive";
export interface RenderSnapshot { state: RenderStateName; url: string; title: string; robots: string; canonical: string; hreflang: string[]; schemaTypes: string[]; text: string; images: string[]; links: string[]; hydrationErrors?: string[]; blockedResources?: string[] }
export interface RenderProfile { device: "googlebot-smartphone" | "mobile" | "desktop"; userAgent: string; width: number; height: number }
export const RENDER_PROFILES: Record<RenderProfile["device"], RenderProfile> = {
  "googlebot-smartphone": { device: "googlebot-smartphone", userAgent: "Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", width: 412, height: 732 },
  mobile: { device: "mobile", userAgent: "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36", width: 390, height: 844 },
  desktop: { device: "desktop", userAgent: "Mozilla/5.0 AppleWebKit/537.36 Chrome/120 Safari/537.36", width: 1440, height: 900 },
};
export interface RenderDifference { field: keyof RenderSnapshot; from: RenderStateName; to: RenderStateName; severity: "low" | "medium" | "high"; message: string; before: unknown; after: unknown }
const normalizedText = (value: string) => value.replace(/\s+/g, " ").trim();
const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
export function compareRenderStates(snapshots: RenderSnapshot[]) {
  const order: RenderStateName[] = ["raw", "rendered", "interactive"]; const sorted = [...snapshots].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state)); const differences: RenderDifference[] = [];
  const add = (field: keyof RenderSnapshot, from: RenderSnapshot, to: RenderSnapshot, severity: RenderDifference["severity"], message: string) => differences.push({ field, from: from.state, to: to.state, severity, message, before: from[field], after: to[field] });
  for (let i = 1; i < sorted.length; i++) { const from = sorted[i - 1], to = sorted[i];
    for (const field of ["title", "robots", "canonical"] as const) if (from[field] !== to[field]) add(field, from, to, field === "robots" || field === "canonical" ? "high" : "medium", `${field} changes after JavaScript execution`);
    for (const field of ["hreflang", "schemaTypes", "images", "links"] as const) if (!sameSet(from[field], to[field])) add(field, from, to, field === "links" ? "high" : "medium", `${field} differs across render states`);
    const before = normalizedText(from.text), after = normalizedText(to.text); if (after.length > before.length * 1.5 && after.length - before.length > 200) add("text", from, to, "high", "Substantial primary content is only available after JavaScript or interaction");
    if (to.hydrationErrors?.length) add("hydrationErrors", from, to, "high", "Hydration errors were observed"); if (to.blockedResources?.length) add("blockedResources", from, to, "medium", "Resources required for rendering were blocked");
  }
  return { snapshots: sorted, differences, clientOnlyContent: differences.some((item) => item.field === "text" && item.from === "raw"), interactionGatedLinks: differences.some((item) => item.field === "links" && item.to === "interactive") };
}
export function detectRenderingFramework(files: string[], packageNames: string[] = []) { const names = new Set(packageNames); const has = (name: string) => names.has(name) || files.some((file) => file.toLowerCase().includes(name.toLowerCase())); if (has("next")) return { framework: "Next.js", mode: files.some((file) => /app[\\/]page\./i.test(file)) ? "hybrid-app-router" : "hybrid-pages-router" }; if (has("@remix-run")) return { framework: "Remix", mode: "ssr" }; if (has("nuxt")) return { framework: "Nuxt", mode: "hybrid" }; if (has("astro")) return { framework: "Astro", mode: "static-or-ssr" }; if (has("gatsby")) return { framework: "Gatsby", mode: "static" }; if (has("react-router")) return { framework: "React Router", mode: "client-or-framework" }; if (has("vite")) return { framework: "Vite", mode: "spa-by-default" }; return { framework: "unknown", mode: "unknown" }; }

