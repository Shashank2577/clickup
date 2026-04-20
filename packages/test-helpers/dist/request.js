"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestRequest = createTestRequest;
const supertest_1 = __importDefault(require("supertest"));
const auth_js_1 = require("./auth.js");
function createTestRequest(app) {
    const agent = (0, supertest_1.default)(app);
    return {
        get: (path) => new AuthedRequest(agent.get(path)),
        post: (path) => new AuthedRequest(agent.post(path)),
        patch: (path) => new AuthedRequest(agent.patch(path)),
        put: (path) => new AuthedRequest(agent.put(path)),
        delete: (path) => new AuthedRequest(agent.delete(path)),
    };
}
class AuthedRequest {
    req;
    constructor(req) {
        this.req = req;
    }
    asUser(ctx) {
        const token = (0, auth_js_1.makeTestToken)(ctx);
        return this.req
            .set('Authorization', `Bearer ${token}`)
            .set('Content-Type', 'application/json')
            .set('x-trace-id', 'test-trace-id');
    }
    unauthenticated() {
        return this.req
            .set('Content-Type', 'application/json')
            .set('x-trace-id', 'test-trace-id');
    }
    raw() {
        return this.req;
    }
}
//# sourceMappingURL=request.js.map