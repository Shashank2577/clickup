"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREQUENCY_CRON_MAP = exports.UpdateRecurringConfigSchema = exports.CreateRecurringConfigSchema = exports.RecurringFrequency = void 0;
const zod_1 = require("zod");
// Simplified cron presets + custom cron expression
exports.RecurringFrequency = zod_1.z.enum(['daily', 'weekly', 'monthly', 'custom']);
exports.CreateRecurringConfigSchema = zod_1.z.object({
    frequency: exports.RecurringFrequency,
    cronExpr: zod_1.z.string().min(5).max(100).optional(), // required when frequency='custom'
    isActive: zod_1.z.boolean().optional().default(true),
}).refine((d) => d.frequency !== 'custom' || !!d.cronExpr, { message: 'cronExpr required when frequency is custom' });
exports.UpdateRecurringConfigSchema = zod_1.z.object({
    frequency: exports.RecurringFrequency.optional(),
    cronExpr: zod_1.z.string().min(5).max(100).optional(),
    isActive: zod_1.z.boolean().optional(),
});
// Frequency → cron mapping
exports.FREQUENCY_CRON_MAP = {
    daily: '0 9 * * *',
    weekly: '0 9 * * 1',
    monthly: '0 9 1 * *',
};
//# sourceMappingURL=recurring.schema.js.map