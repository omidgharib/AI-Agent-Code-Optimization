import { analyzeSeoHtml } from "../analyzers/seoLab";

const valid = `<!doctype html><html lang="en"><head><title>A useful title for a deterministic SEO fixture page</title><meta name="description" content="A sufficiently descriptive summary for search engines and visitors that explains this deterministic fixture page in clear and useful detail."><meta name="viewport" content="width=device-width"><meta name="robots" content="index,follow"><link rel="canonical" href="https://example.test/page"><meta property="og:title" content="Title"><meta property="og:description" content="Description"><meta property="og:image" content="/image.png"><meta property="og:url" content="https://example.test/page"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="Title"><meta name="twitter:description" content="Description"><meta name="twitter:image" content="/image.png"><script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage"}</script></head><body><h1>Page</h1><h2>Details</h2><img src="x" alt="example"></body></html>`;

describe("SEO Lab", () => {
  it("scores complete metadata without deductions", () => {
    const result = analyzeSeoHtml(valid, "https://example.test/page");
    expect(result.score).toBe(100);
    expect(result.findings).toHaveLength(0);
  });

  it("explains metadata, indexability, social, schema and content deductions", () => {
    const html = `<html><head><meta name="robots" content="noindex"><link rel="canonical" href="https://other.test/"><script type="application/ld+json">{bad}</script></head><body><h2>Skip</h2><img src="x"></body></html>`;
    const result = analyzeSeoHtml(html, "https://example.test/page", 200, ["a", "b", "c"]);
    expect(result.score).toBeLessThan(50);
    expect(new Set(result.findings.map((item) => item.category))).toEqual(new Set(["metadata", "indexability", "structuredData", "social", "content"]));
    expect(result.findings.find((item) => item.ruleId === "image-alt")?.selector).toBe("img:not([alt])");
  });
});
