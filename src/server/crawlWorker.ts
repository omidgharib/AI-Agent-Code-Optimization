import fs from "node:fs/promises";
import { crawlSite, type CrawlOptions, type CrawlResult } from "../analyzers/seoCrawler";

async function main() {
  const encoded = process.argv[2]; if (!encoded) throw new Error("Crawler options are required");
  const input = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as { url: string; options: Partial<CrawlOptions>; resumeFile?: string };
  let resume: CrawlResult | undefined; if (input.resumeFile) resume = JSON.parse(await fs.readFile(input.resumeFile, "utf8")) as CrawlResult;
  const result = await crawlSite(input.url, { ...input.options, resume, onProgress: (progress) => process.stdout.write(`${JSON.stringify({ type: "progress", progress })}\n`) });
  process.stdout.write(`${JSON.stringify({ type: "result", result })}\n`);
}
main().catch((error) => { process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error)); process.exitCode = 1; });
