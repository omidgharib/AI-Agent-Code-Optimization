import fs from "node:fs/promises";
import path from "node:path";
import type { ArtifactRef, ArtifactStore } from "./artifactStore";
const mediaTypes: Record<string,string>={".json":"application/json",".md":"text/markdown",".html":"text/html",".sarif":"application/sarif+json"};
export async function importLegacyReports(repositoryPath:string,store:ArtifactStore):Promise<ArtifactRef[]>{const root=path.join(path.resolve(repositoryPath),"ai-auditor-report");const imported:ArtifactRef[]=[];let runs:string[]=[];try{runs=(await fs.readdir(root,{withFileTypes:true})).filter(entry=>entry.isDirectory()).map(entry=>entry.name);}catch{return imported;}for(const run of runs)for(const name of ["report.json","report.md","report.html","report.sarif"]){const file=path.join(root,run,name);try{const bytes=await fs.readFile(file);imported.push(await store.put(bytes,mediaTypes[path.extname(name)]??"application/octet-stream"));}catch{}}return imported;}
