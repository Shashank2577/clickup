import { z } from 'zod';
export declare const FavoriteItemType: z.ZodEnum<["task", "doc", "list", "space", "folder", "dashboard", "view", "goal"]>;
export declare const CreateFavoriteSchema: z.ZodObject<{
    itemType: z.ZodEnum<["task", "doc", "list", "space", "folder", "dashboard", "view", "goal"]>;
    itemId: z.ZodString;
    itemName: z.ZodString;
}, "strip", z.ZodTypeAny, {
    itemType: "task" | "doc" | "list" | "goal" | "space" | "folder" | "dashboard" | "view";
    itemId: string;
    itemName: string;
}, {
    itemType: "task" | "doc" | "list" | "goal" | "space" | "folder" | "dashboard" | "view";
    itemId: string;
    itemName: string;
}>;
export declare const ReorderFavoritesSchema: z.ZodObject<{
    favoriteIds: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    favoriteIds: string[];
}, {
    favoriteIds: string[];
}>;
//# sourceMappingURL=favorites.schema.d.ts.map