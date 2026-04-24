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
    const jsm = await nats.jetstreamManager();
    // Pull consumer implementation
    const stream = 'clickup';
    const durable = options.durable || options.queue || 'consumer-' + subject.replace('.', '-');
    // Ensure consumer exists
    try {
        await jsm.consumers.add(stream, {
            durable_name: durable,
            ack_policy: nats_1.AckPolicy.Explicit,
            filter_subject: subject,
        });
    }
    catch (err) {
        if (!err.message.includes('already exists')) {
            throw err;
        }
    }
    const consumer = await js.consumers.get(stream, durable);
    const messages = await consumer.consume();
    logger_js_1.logger.info({ subject, durable }, 'Subscribed to event (pull consumer)');
    void (async () => {
        for await (const msg of messages) {
            try {
                const raw = sc.decode(msg.data);
                const payload = JSON.parse(raw);
                await handler(payload);
                msg.ack();
            }
            catch (err) {
                logger_js_1.logger.error({ err, subject, durable }, 'Event handler failed — nacking');
                msg.nak();
            }
        }
    })();
}
//# sourceMappingURL=subscriber.js.map