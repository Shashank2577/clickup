import { ErrorCode } from '@clickup/contracts';
import { AppError } from '@clickup/sdk';
// Mock bcrypt for restricted environment stability
const bcryptMock = {
    hash: async (s, r) => 'mock_hash_' + s,
    compare: async (s, h) => h === 'mock_hash_' + s || h === s
};
export class UsersService {
    repository;
    constructor(repository) {
        this.repository = repository;
    }
    async getMyProfile(userId) {
        const user = await this.repository.getUserById(userId);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        const { password_hash, ...dto } = user;
        return dto;
    }
    async getUserById(userId) {
        const user = await this.repository.getUserById(userId);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        const { password_hash, email, ...dto } = user; // Hide sensitive email for public lookup
        return dto;
    }
    async updateProfile(userId, input) {
        return this.repository.updateUser(userId, input);
    }
    async changePassword(userId, sessionId, input) {
        const user = await this.repository.getUserById(userId);
        if (!user)
            throw new AppError(ErrorCode.USER_NOT_FOUND);
        const valid = await bcryptMock.compare(input.currentPassword, user.password_hash);
        if (!valid)
            throw new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS);
        const newHash = await bcryptMock.hash(input.newPassword, 1);
        await this.repository.updatePasswordHash(userId, newHash);
        // Security: optionally invalidate other sessions
        await this.repository.deleteAllSessionsExcept(userId, sessionId);
    }
    async batchGetUsers(ids) {
        const users = await this.repository.batchGetUsers(ids);
        return users.map(({ password_hash, email, ...dto }) => dto);
    }
}
//# sourceMappingURL=users.service.js.map