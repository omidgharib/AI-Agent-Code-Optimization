import type { AuditCommand, JobEvent, Project } from "../../contracts";
import type { ArtifactRef } from "../artifacts/artifactStore";
import type { DurableJob } from "./repositories";
export interface ProjectsRepository { save(tenantId:string,project:Project,privateConfig?:Record<string,unknown>):Promise<void>; get(tenantId:string,id:string):Promise<{public:Project;privateConfig:Record<string,unknown>}|undefined>; list(tenantId:string):Promise<Project[]> }
export interface JobsRepository { create(input:{tenantId:string;projectId:string;idempotencyKey:string;command:AuditCommand;configSnapshot?:Record<string,unknown>}):Promise<{job:DurableJob;duplicate:boolean}>; get(tenantId:string,id:string):Promise<DurableJob|undefined> }
export interface EventsRepository { appendEvent(event:JobEvent):Promise<void>; events(tenantId:string,jobId:string):Promise<Record<string,unknown>[]> }
export interface ArtifactsRepository { put(bytes:Uint8Array,mediaType:string):Promise<ArtifactRef>; get(id:string):Promise<Uint8Array|undefined> }
