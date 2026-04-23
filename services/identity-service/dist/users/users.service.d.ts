import type { UsersRepository } from './users.repository.js';
export declare class UsersService {
    private readonly repository;
    constructor(repository: UsersRepository);
    getMyProfile(userId: string): Promise<{
        id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        timezone: string;
        email_verified: boolean;
        created_at: Date;
        updated_at: Date;
    }>;
    getUserById(userId: string): Promise<{
        id: string;
        name: string;
        avatar_url: string | null;
        timezone: string;
        email_verified: boolean;
        created_at: Date;
        updated_at: Date;
    }>;
    updateProfile(userId: string, input: {
        name?: string;
        avatarUrl?: string | null;
        timezone?: string;
    }): Promise<Omit<import("./users.repository.js").UserRow, "password_hash">>;
    changePassword(userId: string, sessionId: string, input: {
        currentPassword: string;
        newPassword: string;
    }): Promise<void>;
    batchGetUsers(ids: string[]): Promise<{
        id: string;
        name: string;
        avatar_url: string | null;
        timezone: string;
        email_verified: boolean;
        created_at: Date;
        updated_at: Date;
    }[]>;
}
//# sourceMappingURL=users.service.d.ts.map