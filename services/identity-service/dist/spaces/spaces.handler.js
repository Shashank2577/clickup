import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError, tier2Del, CacheKeys } from '@clickup/sdk';
import { ErrorCode, CreateSpaceSchema, UpdateSpaceSchema } from '@clickup/contracts';
import { SpacesRepository } from './spaces.repository.js';
function toSpaceDto(row) {
    return {
        id: row.id,
        workspaceId: row.workspace_id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        isPrivate: row.is_private,
        position: row.position,
        createdBy: row.created_by,
    };
}
// Routes mounted at /workspaces/:workspaceId/spaces
export function workspaceSpacesRoutes(db) {
    const router = Router({ mergeParams: true });
    const repository = new SpacesRepository(db);
    // POST /workspaces/:workspaceId/spaces
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const member = await repository.getWorkspaceMember(workspaceId, req.auth.userId);
        if (!member)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        if (!['owner', 'admin'].includes(member.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const input = validate(CreateSpaceSchema, req.body);
        const maxPos = await repository.getMaxPosition(workspaceId);
        const space = await repository.createSpace({
            workspaceId,
            name: input.name,
            color: input.color,
            icon: input.icon,
            isPrivate: input.isPrivate,
            createdBy: req.auth.userId,
            position: maxPos + 1000,
        });
        await tier2Del(CacheKeys.spaceHierarchy(workspaceId));
        res.status(201).json({ data: toSpaceDto(space) });
    }));
    // GET /workspaces/:workspaceId/spaces
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const member = await repository.getWorkspaceMember(workspaceId, req.auth.userId);
        if (!member)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const spaces = await repository.getSpacesByWorkspace(workspaceId, req.auth.userId);
        res.json({ data: spaces.map(toSpaceDto) });
    }));
    return router;
}
// Routes mounted at /spaces
export function spacesRoutes(db) {
    const router = Router({ mergeParams: true });
    const repository = new SpacesRepository(db);
    // GET /spaces/:spaceId
    router.get('/:spaceId', requireAuth, asyncHandler(async (req, res) => {
        const { spaceId } = req.params;
        if (!spaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required');
        const space = await repository.getSpace(spaceId);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        res.json({ data: toSpaceDto(space) });
    }));
    // PATCH /spaces/:spaceId
    router.patch('/:spaceId', requireAuth, asyncHandler(async (req, res) => {
        const { spaceId } = req.params;
        if (!spaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required');
        const space = await repository.getSpace(spaceId);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member || !['owner', 'admin'].includes(member.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const input = validate(UpdateSpaceSchema, req.body);
        const updated = await repository.updateSpace(spaceId, input);
        await tier2Del(CacheKeys.spaceHierarchy(space.workspace_id));
        res.json({ data: toSpaceDto(updated) });
    }));
    // DELETE /spaces/:spaceId (soft delete)
    router.delete('/:spaceId', requireAuth, asyncHandler(async (req, res) => {
        const { spaceId } = req.params;
        if (!spaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required');
        const space = await repository.getSpace(spaceId);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member || member.role !== 'owner')
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        // Atomic: soft-delete lists then space in a single transaction
        const client = await db.connect();
        try {
            await client.query('BEGIN');
            await repository.softDeleteListsBySpace(spaceId, client);
            await repository.softDeleteSpace(spaceId, client);
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        await tier2Del(CacheKeys.spaceHierarchy(space.workspace_id));
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=spaces.handler.js.map