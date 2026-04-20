"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const contracts_1 = require("@clickup/contracts");
const AppError_js_1 = require("../errors/AppError.js");
// ============================================================
// Validate input against a Zod schema from @clickup/contracts
// Throws AppError with VALIDATION_INVALID_INPUT on failure.
// Usage: const input = validate(CreateTaskSchema, req.body)
// ============================================================
function validate(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
        const details = formatZodErrors(result.error);
        throw new AppError_js_1.AppError(contracts_1.ErrorCode.VALIDATION_INVALID_INPUT, 'Validation failed', { fields: details });
    }
    return result.data;
}
function formatZodErrors(error) {
    const fields = {};
    for (const issue of error.issues) {
        const path = issue.path.join('.') || 'root';
        if (fields[path] === undefined) {
            fields[path] = [];
        }
        fields[path].push(issue.message);
    }
    return fields;
}
//# sourceMappingURL=validate.js.map