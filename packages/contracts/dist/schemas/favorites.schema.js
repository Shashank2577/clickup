"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReorderFavoritesSchema = exports.CreateFavoriteSchema = exports.FavoriteItemType = void 0;
const zod_1 = require("zod");
exports.FavoriteItemType = zod_1.z.enum(['task', 'doc', 'list', 'space', 'folder', 'dashboard', 'view', 'goal']);
exports.CreateFavoriteSchema = zod_1.z.object({
    itemType: exports.FavoriteItemType,
    itemId: zod_1.z.string().uuid(),
    itemName: zod_1.z.string().min(1).max(255),
});
exports.ReorderFavoritesSchema = zod_1.z.object({
    favoriteIds: zod_1.z.array(zod_1.z.string().uuid()).min(1),
});
//# sourceMappingURL=favorites.schema.js.map