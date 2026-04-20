import type { EventSubject } from '@clickup/contracts';
export declare function subscribe<T>(subject: EventSubject, handler: (payload: T) => Promise<void>, options?: {
    durable?: string;
    queue?: string;
}): Promise<void>;
//# sourceMappingURL=subscriber.d.ts.map