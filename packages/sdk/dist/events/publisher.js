"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNats = getNats;
exports.publish = publish;
const nats_1 = require("nats");
const logger_js_1 = require("../logging/logger.js");
// ============================================================
// NATS JetStream publisher
// Usage: await publish('task.created', payload)
// ============================================================
let natsConnection = null;
const sc = (0, nats_1.StringCodec)();
async function getNats() {
    if (natsConnection === null) {
        natsConnection = await (0, nats_1.connect)({
            servers: process.env['NATS_URL'] ?? 'nats://localhost:4222',
            reconnect: true,
            maxReconnectAttempts: -1,
            reconnectTimeWait: 2000,
        });
        logger_js_1.logger.info('Connected to NATS');
        natsConnection.closed().then(() => {
            logger_js_1.logger.warn('NATS connection closed');
            natsConnection = null;
        }).catch((err) => {
            logger_js_1.logger.error({ err }, 'NATS connection error');
        });
    }
    return natsConnection;
}
async function publish(subject, payload) {
    try {
        const nats = await getNats();
        const js = nats.jetstream();
        await js.publish('clickup.' + subject, sc.encode(JSON.stringify(payload)));
        logger_js_1.logger.debug({ subject }, 'Event published');
    }
    catch (err) {
        // Publishing failures are logged but never crash the service.
        // Downstream services handle eventual consistency.
        logger_js_1.logger.error({ err, subject }, 'Failed to publish event');
    }
}
//# sourceMappingURL=publisher.js.map