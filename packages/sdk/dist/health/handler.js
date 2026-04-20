"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthHandler = createHealthHandler;
const client_js_1 = require("../cache/client.js");
const publisher_js_1 = require("../events/publisher.js");
const logger_js_1 = require("../logging/logger.js");
function createHealthHandler(db) {
    return async function healthHandler(_req, res) {
        const service = process.env['SERVICE_NAME'] ?? 'unknown';
        const checks = {
            postgres: 'fail',
            redis: 'fail',
            nats: 'fail',
        };
        await Promise.all([
            db.query('SELECT 1').then(() => { checks.postgres = 'ok'; }).catch((err) => {
                logger_js_1.logger.error({ err }, 'Health check: postgres failed');
            }),
            (0, client_js_1.getRedis)().ping().then(() => { checks.redis = 'ok'; }).catch((err) => {
                logger_js_1.logger.error({ err }, 'Health check: redis failed');
            }),
            (0, publisher_js_1.getNats)().then(() => { checks.nats = 'ok'; }).catch((err) => {
                logger_js_1.logger.error({ err }, 'Health check: nats failed');
            }),
        ]);
        const allOk = Object.values(checks).every((v) => v === 'ok');
        const status = {
            status: allOk ? 'ok' : 'degraded',
            service,
            timestamp: new Date().toISOString(),
            checks,
        };
        res.status(allOk ? 200 : 503).json(status);
    };
}
//# sourceMappingURL=handler.js.map