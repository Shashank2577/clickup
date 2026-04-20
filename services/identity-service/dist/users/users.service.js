import bcrypt from 'bcrypt';
import { ErrorCode } from '@clickup/contracts';
import { AppError, tier2Get, tier2Set, tier2Del, CacheKeys } from '@clickup/sdk';
function toUserDto(user) {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatar_url,
        timezone: user.timezone,
        createdAt: user.created_at.toISOString(),
    };
}
export class UsersService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getMyProfile(userId) {
        const cacheKey = CacheKeys.userProfile(userId);
        const cached = await tier2Get(cacheKey);
        if (cached)
            return cached;
        const user = await this.repository.getUserById(userId);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        const dto = toUserDto(user);
        await tier2Set(cacheKey, dto);
        return dto;
    }
    async updateProfile(userId, input) {
        const user = await this.repository.updateUser(userId, input);
        await tier2Del(CacheKeys.userProfile(userId));
        return toUserDto(user);
    }
    async changePassword(userId, sessionId, input) {
        const user = await this.repository.getUserById(userId);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        const valid = await bcrypt.compare(input.currentPassword, user.password_hash);
        if (!valid)
            throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS);
        const newHash = await bcrypt.hash(input.newPassword, 12);
        await this.repository.updatePasswordHash(userId, newHash);
        // Invalidate all OTHER sessions (security: force re-login on other devices)
        await this.repository.deleteAllSessionsExcept(userId, sessionId);
        await tier2Del(CacheKeys.userProfile(userId));
    }
    async getUserById(id) {
        const user = await this.repository.getUserById(id);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        return toUserDto(user);
    }
    async batchGetUsers(ids) {
        if (ids.length > 100)
            throw new AppError(ErrorCode.VALIDATION_INVALID_INPUT, 'Max 100 IDs per batch request');
        const rows = await this.repository.batchGetUsers(ids);
        return rows.map((r) => toUserDto(r));
    }
}
//# sourceMappingURL=users.service.js.map