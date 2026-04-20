import { type NatsConnection } from 'nats';
import type { EventSubject } from '@clickup/contracts';
export declare function getNats(): Promise<NatsConnection>;
export declare function publish(subject: EventSubject, payload: unknown): Promise<void>;
//# sourceMappingURL=publisher.d.ts.map