import { z } from 'zod';
export declare const RecurringFrequency: z.ZodEnum<["daily", "weekly", "monthly", "custom"]>;
export declare const CreateRecurringConfigSchema: z.ZodEffects<z.ZodObject<{
    frequency: z.ZodEnum<["daily", "weekly", "monthly", "custom"]>;
    cronExpr: z.ZodOptional<z.ZodString>;
    isActive: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    isActive: boolean;
    frequency: "custom" | "daily" | "weekly" | "monthly";
    cronExpr?: string | undefined;
}, {
    frequency: "custom" | "daily" | "weekly" | "monthly";
    isActive?: boolean | undefined;
    cronExpr?: string | undefined;
}>, {
    isActive: boolean;
    frequency: "custom" | "daily" | "weekly" | "monthly";
    cronExpr?: string | undefined;
}, {
    frequency: "custom" | "daily" | "weekly" | "monthly";
    isActive?: boolean | undefined;
    cronExpr?: string | undefined;
}>;
export declare const UpdateRecurringConfigSchema: z.ZodObject<{
    frequency: z.ZodOptional<z.ZodEnum<["daily", "weekly", "monthly", "custom"]>>;
    cronExpr: z.ZodOptional<z.ZodString>;
    isActive: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    isActive?: boolean | undefined;
    frequency?: "custom" | "daily" | "weekly" | "monthly" | undefined;
    cronExpr?: string | undefined;
}, {
    isActive?: boolean | undefined;
    frequency?: "custom" | "daily" | "weekly" | "monthly" | undefined;
    cronExpr?: string | undefined;
}>;
export declare const FREQUENCY_CRON_MAP: Record<string, string>;
export type CreateRecurringConfigInput = z.infer<typeof CreateRecurringConfigSchema>;
export type UpdateRecurringConfigInput = z.infer<typeof UpdateRecurringConfigSchema>;
//# sourceMappingURL=recurring.schema.d.ts.map