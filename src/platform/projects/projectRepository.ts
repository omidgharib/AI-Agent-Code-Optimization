import type { Project } from "../../contracts";
export interface ProjectRepository { get(id: string): Promise<Project | undefined>; save(project: Project): Promise<void> }
export class InMemoryProjectRepository implements ProjectRepository { private readonly values = new Map<string, Project>(); async get(id: string) { return this.values.get(id); } async save(project: Project) { this.values.set(project.id, project); } }
