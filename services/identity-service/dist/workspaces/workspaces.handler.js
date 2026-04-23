import { Router } from 'express';
import { requireAuth, asyncHandler, validate, AppError, tier2Get, tier2Set, tier2Del, CacheKeys, publish } from '@clickup/sdk';
import { ErrorCode, CreateWorkspaceSchema, UpdateWorkspaceSchema, InviteMemberSchema, UpdateMemberRoleSchema, WORKSPACE_EVENTS } from '@clickup/contracts';
import { WorkspacesRepository } from './workspaces.repository.js';
import { AuditRepository } from '../audit/audit.repository.js';
function toWorkspaceDto(row) {
    return { id: row.id, name: row.name, slug: row.slug, ownerId: row.owner_id, logoUrl: row.logo_url, createdAt: row.created_at.toISOString() };
}
function toMemberDto(row) {
    return { workspaceId: row.workspace_id, userId: row.user_id, role: row.role, joinedAt: row.joined_at.toISOString() };
}
export function workspacesRoutes(db) {
    const router = Router();
    const repository = new WorkspacesRepository(db);
    const auditRepository = new AuditRepository(db);
    // POST /workspaces — create workspace
    router.post('/', requireAuth, asyncHandler(async (req, res) => {
        const input = validate(CreateWorkspaceSchema, req.body);
        const existing = await repository.getWorkspaceBySlug(input.slug);
        if (existing)
            throw new AppError(ErrorCode.WORKSPACE_SLUG_TAKEN);
        // Atomic: create workspace + add creator as owner
        const client = await db.connect();
        let workspace;
        try {
            await client.query('BEGIN');
            workspace = await repository.createWorkspace(client, { ...input, ownerId: req.auth.userId });
            await repository.addMember(client, { workspaceId: workspace.id, userId: req.auth.userId, role: 'owner' });
            await client.query('COMMIT');
        }
        catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }
        finally {
            client.release();
        }
        await tier2Del(CacheKeys.workspaceMembers(workspace.id));
        await publish(WORKSPACE_EVENTS.MEMBER_ADDED, {
            workspaceId: workspace.id,
            userId: req.auth.userId,
            role: 'owner',
            addedBy: req.auth.userId,
            occurredAt: new Date().toISOString(),
        });
        res.status(201).json({ data: toWorkspaceDto(workspace) });
    }));
    // GET /workspaces/me — list user's workspaces
    router.get('/me', requireAuth, asyncHandler(async (req, res) => {
        const workspaces = await repository.getUserWorkspaces(req.auth.userId);
        res.json({ data: workspaces.map(toWorkspaceDto) });
    }));
    // GET /workspaces/:workspaceId
    router.get('/:workspaceId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const member = await repository.getMember(workspaceId, req.auth.userId);
        if (!member)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const workspace = await repository.getWorkspace(workspaceId);
        if (!workspace)
            throw new AppError(ErrorCode.WORKSPACE_NOT_FOUND);
        res.json({ data: toWorkspaceDto(workspace) });
    }));
    // PATCH /workspaces/:workspaceId
    router.patch('/:workspaceId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const member = await repository.getMember(workspaceId, req.auth.userId);
        if (!member || !['owner', 'admin'].includes(member.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const input = validate(UpdateWorkspaceSchema, req.body);
        const workspace = await repository.updateWorkspace(workspaceId, input);
        res.json({ data: toWorkspaceDto(workspace) });
    }));
    // POST /workspaces/:workspaceId/members — invite member
    router.post('/:workspaceId/members', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const requester = await repository.getMember(workspaceId, req.auth.userId);
        if (!requester || !['owner', 'admin'].includes(requester.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const input = validate(InviteMemberSchema, req.body);
        const user = await repository.getUserByEmail(input.email);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        const existing = await repository.getMember(workspaceId, user.id);
        if (existing)
            throw new AppError(ErrorCode.WORKSPACE_MEMBER_ALREADY_EXISTS);
        await repository.addMember(db, { workspaceId, userId: user.id, role: input.role });
        await tier2Del(CacheKeys.workspaceMembers(workspaceId));
        // Publish event AFTER DB write
        await publish(WORKSPACE_EVENTS.MEMBER_ADDED, {
            workspaceId,
            userId: user.id,
            role: input.role,
            addedBy: req.auth.userId,
            occurredAt: new Date().toISOString(),
        });
        // Audit log
        await auditRepository.logEvent({
            workspaceId,
            actorId: req.auth.userId,
            resourceType: 'workspace_member',
            resourceId: user.id,
            action: 'member.added',
            metadata: { role: input.role },
            ipAddress: req.ip ?? null,
        }).catch(() => { });
        res.status(201).json({ data: { workspaceId, userId: user.id, role: input.role } });
    }));
    // DELETE /workspaces/:workspaceId/members/:userId — remove member
    router.delete('/:workspaceId/members/:userId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, userId } = req.params;
        if (!workspaceId || !userId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required');
        const requester = await repository.getMember(workspaceId, req.auth.userId);
        if (!requester || !['owner', 'admin'].includes(requester.role))
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const member = await repository.getMember(workspaceId, userId);
        if (!member)
            throw new AppError(ErrorCode.WORKSPACE_MEMBER_NOT_FOUND);
        if (member.role === 'owner')
            throw new AppError(ErrorCode.WORKSPACE_OWNER_CANNOT_LEAVE);
        await repository.removeMember(workspaceId, userId);
        await tier2Del(CacheKeys.workspaceMembers(workspaceId));
        await publish(WORKSPACE_EVENTS.MEMBER_REMOVED, {
            workspaceId,
            userId,
            removedBy: req.auth.userId,
            occurredAt: new Date().toISOString(),
        });
        // Audit log
        await auditRepository.logEvent({
            workspaceId,
            actorId: req.auth.userId,
            resourceType: 'workspace_member',
            resourceId: userId,
            action: 'member.removed',
            ipAddress: req.ip ?? null,
        }).catch(() => { });
        res.status(204).end();
    }));
    // PATCH /workspaces/:workspaceId/members/:userId — update role
    router.patch('/:workspaceId/members/:userId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, userId } = req.params;
        if (!workspaceId || !userId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required');
        const requester = await repository.getMember(workspaceId, req.auth.userId);
        if (!requester || requester.role !== 'owner')
            throw new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSION);
        const member = await repository.getMember(workspaceId, userId);
        if (!member)
            throw new AppError(ErrorCode.WORKSPACE_MEMBER_NOT_FOUND);
        if (member.role === 'owner')
            throw new AppError(ErrorCode.WORKSPACE_OWNER_CANNOT_LEAVE);
        const input = validate(UpdateMemberRoleSchema, req.body);
        await repository.updateMemberRole(workspaceId, userId, input.role);
        await tier2Del(CacheKeys.workspaceMembers(workspaceId));
        // Audit log
        await auditRepository.logEvent({
            workspaceId,
            actorId: req.auth.userId,
            resourceType: 'workspace_member',
            resourceId: userId,
            action: 'member.role_changed',
            metadata: { newRole: input.role, previousRole: member.role },
            ipAddress: req.ip ?? null,
        }).catch(() => { });
        res.json({ data: { workspaceId, userId, role: input.role } });
    }));
    // GET /workspaces/:workspaceId/members — list members (cached)
    router.get('/:workspaceId/members', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId } = req.params;
        if (!workspaceId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'workspaceId is required');
        const self = await repository.getMember(workspaceId, req.auth.userId);
        if (!self)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const cacheKey = CacheKeys.workspaceMembers(workspaceId);
        const cached = await tier2Get(cacheKey);
        if (cached) {
            res.json({ data: cached });
            return;
        }
        const members = await repository.getMembers(workspaceId);
        const dtos = members.map(toMemberDto);
        await tier2Set(cacheKey, dtos);
        res.json({ data: dtos });
    }));
    // GET /workspaces/:workspaceId/members/:userId — check membership
    router.get('/:workspaceId/members/:userId', requireAuth, asyncHandler(async (req, res) => {
        const { workspaceId, userId } = req.params;
        if (!workspaceId || !userId)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'IDs are required');
        const self = await repository.getMember(workspaceId, req.auth.userId);
        if (!self)
            throw new AppError(ErrorCode.AUTH_WORKSPACE_ACCESS_DENIED);
        const member = await repository.getMember(workspaceId, userId);
        if (!member)
            throw new AppError(ErrorCode.WORKSPACE_MEMBER_NOT_FOUND);
        res.json({ data: toMemberDto(member) });
    }));
    return router;
}
//# sourceMappingURL=workspaces.handler.js.map