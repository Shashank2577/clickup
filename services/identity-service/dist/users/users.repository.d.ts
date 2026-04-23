import { Pool } from 'pg';
export interface UserRow {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    timezone: string;
    password_hash: string;
    email_verified: boolean;
    created_at: Date;
    updated_at: Date;
}
export declare class UsersRepository {
    private readonly db;
    constructor(db: Pool);
    getUserById(id: string): Promise<UserRow | null>;
    updateUser(id: string, input: {
        name?: string;
        avatarUrl?: string | null;
        timezone?: string;
    }): Promise<Omit<UserRow, 'password_hash'>>;
    updatePasswordHash(id: string, hash: string): Promise<void>;
    deleteAllSessionsExcept(userId: string, sessionId: string): Promise<void>;
    batchGetUsers(ids: string[]): Promise<UserRow[]>;
}
//# sourceMappingURL=users.repository.d.ts.map