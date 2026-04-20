"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestUser = createTestUser;
const crypto_1 = require("crypto");
const bcrypt_1 = __importDefault(require("bcrypt"));
async function createTestUser(db, override = {}) {
    const id = (0, crypto_1.randomUUID)();
    const password = override.password ?? 'test-password-123';
    const email = override.email ?? `user-${id.slice(0, 8)}@test.com`;
    const name = override.name ?? `Test User ${id.slice(0, 8)}`;
    const passwordHash = await bcrypt_1.default.hash(password, 4);
    await db.query(`INSERT INTO users (id, email, name, password_hash) VALUES ($1, $2, $3, $4)`, [id, email, name, passwordHash]);
    return { id, email, name, password };
}
//# sourceMappingURL=users.fixture.js.map