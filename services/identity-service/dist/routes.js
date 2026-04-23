import { Router } from 'express';
import { authRoutes } from './auth/auth.handler.js';
import { usersRoutes } from './users/users.handler.js';
import { workspacesRoutes } from './workspaces/workspaces.handler.js';
import { workspaceSpacesRoutes, spacesRoutes } from './spaces/spaces.handler.js';
import { spaceListsRoutes, listsRoutes, folderListsRoutes } from './lists/lists.handler.js';
import { spaceFoldersRoutes, foldersRoutes } from './folders/folders.handler.js';
import { auditHandler } from './audit/audit.handler.js';
import { userPreferencesRouter, workspaceClickAppsRouter } from './preferences/preferences.handler.js';
import { favoritesRouter } from './favorites/favorites.handler.js';
import { recentlyViewedRouter } from './recently-viewed/recently-viewed.handler.js';
import { apiKeysRouter } from './api-keys/api-keys.handler.js';
import { savedSearchesRouter } from './saved-searches/saved-searches.handler.js';
import { workspaceInvitesRouter, inviteAcceptRouter } from './invites/invites.handler.js';
import { commandPaletteRouter } from './search/command-palette.handler.js';
/**
 * Main router for identity-service.
 * Base prefix /api/v1 handled by Express app, sub-prefixes here.
 * Mount order matters — more specific paths first.
 */
export function routes(db) {
    const router = Router();
    router.use('/auth', authRoutes(db));
    // User preferences — must come before /users generic routes
    router.use('/users/preferences', userPreferencesRouter(db));
    router.use('/users', usersRoutes(db));
    // Workspace sub-resources — most specific first
    router.use('/workspaces/:workspaceId/clickapps', workspaceClickAppsRouter(db));
    router.use('/workspaces/:workspaceId/favorites', favoritesRouter(db));
    router.use('/workspaces/:workspaceId/recently-viewed', recentlyViewedRouter(db));
    router.use('/workspaces/:workspaceId/api-keys', apiKeysRouter(db));
    router.use('/workspaces/:workspaceId/saved-searches', savedSearchesRouter(db));
    router.use('/workspaces/:workspaceId/invites', workspaceInvitesRouter(db));
    router.use('/workspaces/:workspaceId/spaces', workspaceSpacesRoutes(db));
    router.use('/workspaces/:workspaceId/audit-log', auditHandler(db));
    router.use('/workspaces', workspacesRoutes(db));
    // Invite acceptance (no :workspaceId prefix)
    router.use('/invites', inviteAcceptRouter(db));
    // Command palette / quick search
    router.use('/command-palette', commandPaletteRouter(db));
    router.use('/spaces/:spaceId/folders', spaceFoldersRoutes(db));
    router.use('/spaces/:spaceId/lists', spaceListsRoutes(db));
    router.use('/spaces', spacesRoutes(db));
    router.use('/folders/:folderId/lists', folderListsRoutes(db));
    router.use('/folders', foldersRoutes(db));
    router.use('/lists', listsRoutes(db));
    return router;
}
//# sourceMappingURL=routes.js.map