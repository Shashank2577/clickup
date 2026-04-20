"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribe = subscribe;
const nats_1 = require("nats");
const publisher_js_1 = require("./publisher.js");
const logger_js_1 = require("../logging/logger.js");
// ============================================================
// NATS JetStream subscriber
// Usage:
//   await subscribe('task.created', async (payload) => { ... })
// ============================================================
const sc = (0, nats_1.StringCodec)();
async function subscribe(subject, handler, options = {}) {
    const nats = await (0, publisher_js_1.getNats)();
    const js = nats.jetstream();
    const consumerOptions = js.consumers.get;
    void consumerOptions; // suppress unused warning
    const sub = await js.subscribe(subject, {
        config: {
            ...(options.durable && { durable_name: options.durable }),
            ...(options.queue && { deliver_subject: options.queue }),
        },
    });
    logger_js_1.logger.info({ subject }, 'Subscribed to event');
    void (async () => {
        for await (const msg of sub) {
            try {
                const raw = sc.decode(msg.data);
                const payload = JSON.parse(raw);
                await handler(payload);
                msg.ack();
            }
            catch (err) {
                logger_js_1.logger.error({ err, subject }, 'Event handler failed — nacking');
                msg.nak();
            }
        }
    })();
}
//# sourceMappingURL=subscriber.js.map