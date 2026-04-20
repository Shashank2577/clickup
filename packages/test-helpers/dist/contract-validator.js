"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateResponse = validateResponse;
exports.validatePaginatedResponse = validatePaginatedResponse;
const zod_1 = require("zod");
const sdk_1 = require("@clickup/sdk");
const contracts_1 = require("@clickup/contracts");
const validators = {
    task: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        listId: zod_1.z.string().uuid(),
        title: zod_1.z.string(),
        priority: zod_1.z.string(),
        createdBy: zod_1.z.string().uuid(),
        createdAt: zod_1.z.string(),
        updatedAt: zod_1.z.string(),
    }),
    user: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        email: zod_1.z.string().email(),
        name: zod_1.z.string(),
        createdAt: zod_1.z.string(),
    }),
    workspace: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
        slug: zod_1.z.string(),
        ownerId: zod_1.z.string().uuid(),
    }),
    workspaceMember: zod_1.z.object({
        workspaceId: zod_1.z.string().uuid(),
        userId: zod_1.z.string().uuid(),
        role: zod_1.z.string(),
        joinedAt: zod_1.z.string(),
    }),
    space: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        workspaceId: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
    }),
    list: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        spaceId: zod_1.z.string().uuid(),
        name: zod_1.z.string(),
    }),
    comment: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        taskId: zod_1.z.string().uuid(),
        body: zod_1.z.string(),
        authorId: zod_1.z.string().uuid(),
    }),
    notification: zod_1.z.object({
        id: zod_1.z.string().uuid(),
        userId: zod_1.z.string().uuid(),
        type: zod_1.z.string(),
        isRead: zod_1.z.boolean(),
    }),
};
function validateResponse(entityType, data) {
    const validator = validators[entityType];
    if (!validator) {
        throw new sdk_1.AppError(contracts_1.ErrorCode.VALIDATION_INVALID_INPUT, `No validator registered for entity type: "${entityType}"`);
    }
    const result = validator.safeParse(data);
    if (!result.success) {
        throw new sdk_1.AppError(contracts_1.ErrorCode.VALIDATION_INVALID_INPUT, `Contract violation for "${entityType}":\n${result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n')}`);
    }
    return true;
}
function validatePaginatedResponse(entityType, data) {
    const itemValidator = validators[entityType];
    if (!itemValidator) {
        throw new sdk_1.AppError(contracts_1.ErrorCode.VALIDATION_INVALID_INPUT, `No validator registered for entity type: "${entityType}"`);
    }
    const schema = zod_1.z.object({
        items: zod_1.z.array(itemValidator),
        total: zod_1.z.number(),
        page: zod_1.z.number(),
        limit: zod_1.z.number(),
    });
    const result = schema.safeParse(data);
    if (!result.success) {
        throw new sdk_1.AppError(contracts_1.ErrorCode.VALIDATION_INVALID_INPUT, `Paginated contract violation for "${entityType}":\n${result.error.issues
            .map((i) => `  ${i.path.join('.')}: ${i.message}`)
            .join('\n')}`);
    }
    return true;
}
//# sourceMappingURL=contract-validator.js.map