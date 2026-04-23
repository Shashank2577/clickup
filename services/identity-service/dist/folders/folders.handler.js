import { Router } from 'express';
import { requireAuth, asyncHandler, AppError } from '@clickup/sdk';
import { ErrorCode } from '@clickup/contracts';
import { FoldersRepository } from './folders.repository.js';
function toFolderDto(row) {
    return {
        id: row.id,
        spaceId: row.space_id,
        name: row.name,
        color: row.color,
        position: row.position,
        isPrivate: row.is_private,
        createdBy: row.created_by,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
function toFolderWithListsDto(row) {
    return {
        ...toFolderDto(row),
        lists: row.lists.map((l) => ({
            id: l.id,
            name: l.name,
            color: l.color,
            position: l.position,
            isArchived: l.is_archived,
            folderId: l.folder_id,
        })),
    };
}
// Routes mounted at /spaces/:spaceId/folders (mergeParams: true)
export function spaceFoldersRoutes(db) {
    const router = Router({ mergeParams: true });
    const repository = new FoldersRepository(db);
    // GET /spaces/:spaceId/folders — list folders in a space (with lists inside each)
    router.get('/', requireAuth, asyncHandler(async (req, res) => {
        const { spaceId } = req.params;
        if (!spaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required');
        const space = await repository.getSpaceWithWorkspace(spaceId);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const folders = await repository.getFoldersWithListsBySpace(spaceId);
        res.json({ data: folders.map(toFolderWithListsDto) });
    }));
    // POST /spaces/:spaceId/folders — create folder
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const { spaceId } = req.params;
        if (!spaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'spaceId is required');
        const space = await repository.getSpaceWithWorkspace(spaceId);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        if (!['owner', 'admin'].includes(member.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const { name, color, isPrivate } = req.body;
        if (!name || typeof name !== 'string' || name.trim().length === 0) {
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'name is required');
        }
        const maxPos = await repository.getMaxPosition(spaceId);
        const folder = await repository.createFolder({
            spaceId,
            name: name.trim(),
            color: color ?? null,
            isPrivate: isPrivate ?? false,
            createdBy: req.auth.userId,
            position: maxPos + 1000,
        });
        res.status(201).json({ data: toFolderDto(folder) });
    }));
    return router;
}
// Routes mounted at /folders (for PATCH and DELETE by folderId)
export function foldersRoutes(db) {
    const router = Router();
    const repository = new FoldersRepository(db);
    // PATCH /folders/:folderId
    router.patch('/:folderId', requireAuth, asyncHandler(async (req, res) => {
        const { folderId } = req.params;
        if (!folderId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'folderId is required');
        const folder = await repository.getFolder(folderId);
        if (!folder)
            throw new AppError(ErrorCode.FOLDER_NOT_FOUND);
        const space = await repository.getSpaceWithWorkspace(folder.space_id);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member || !['owner', 'admin'].includes(member.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const { name, color } = req.body;
        const updated = await repository.updateFolder(folderId, { name, color });
        res.json({ data: toFolderDto(updated) });
    }));
    // DELETE /folders/:folderId — lists inside become folderless, not deleted
    router.delete('/:folderId', requireAuth, asyncHandler(async (req, res) => {
        const { folderId } = req.params;
        if (!folderId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'folderId is required');
        const folder = await repository.getFolder(folderId);
        if (!folder)
            throw new AppError(ErrorCode.FOLDER_NOT_FOUND);
        const space = await repository.getSpaceWithWorkspace(folder.space_id);
        if (!space)
            throw new AppError(ErrorCode.SPACE_NOT_FOUND);
        const member = await repository.getWorkspaceMember(space.workspace_id, req.auth.userId);
        if (!member || !['owner', 'admin'].includes(member.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        await repository.deleteFolder(folderId);
        res.status(204).end();
    }));
    return router;
}
//# sourceMappingURL=folders.handler.js.map