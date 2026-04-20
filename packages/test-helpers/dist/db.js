"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTestDb = getTestDb;
exports.closeTestDb = closeTestDb;
exports.withRollback = withRollback;
exports.setupTestDb = setupTestDb;
const pg_1 = require("pg");
const promises_1 = require("fs/promises");
const path_1 = require("path");
let _pool = null;
function getTestDb() {
    if (!_pool) {
        _pool = new pg_1.Pool({
            connectionString: process.env['DATABASE_URL'] ??
                'postgres://clickup:clickup@localhost:5432/clickup_test',
            max: 5,
        });
    }
    return _pool;
}
async function closeTestDb() {
    if (_pool) {
        await _pool.end();
        _pool = null;
    }
}
async function withRollback(fn) {
    const pool = getTestDb();
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        return result;
    }
    finally {
        await client.query('ROLLBACK');
        client.release();
    }
}
async function setupTestDb() {
    const pool = getTestDb();
    const migrationsDir = (0, path_1.resolve)(process.cwd(), '../../infra/migrations');
    const files = (await (0, promises_1.readdir)(migrationsDir))
        .filter((f) => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        const sql = await (0, promises_1.readFile)((0, path_1.join)(migrationsDir, file), 'utf-8');
        await pool.query(sql);
    }
    await closeTestDb();
}
//# sourceMappingURL=db.js.map