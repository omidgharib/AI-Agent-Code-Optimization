import type { AuditCommand, JobEvent } from "../../contracts";
export interface JobBus { dispatch(command: AuditCommand): Promise<void>; publish(event: JobEvent): Promise<void> }
