import type { UsersRepository } from './users.repository.js';
export declare class UsersService {
    private readonly repository;
    constructor(repository: UsersRepository);
    getMyProfile(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        timezone: string;
        createdAt: string;
    }>;
    updateProfile(userId: string, input: {
        name?: string;
        avatarUrl?: string | null;
        timezone?: string;
    }): Promise<{
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        timezone: string;
        createdAt: string;
    }>;
    changePassword(userId: string, sessionId: string, input: {
        currentPassword: string;
        newPassword: string;
    }): Promise<void>;
    getUserById(id: string): Promise<{
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        timezone: string;
        createdAt: string;
    }>;
    batchGetUsers(ids: string[]): Promise<{
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        timezone: string;
        createdAt: string;
    }[]>;
}
//# sourceMappingURL=users.service.d.ts.map