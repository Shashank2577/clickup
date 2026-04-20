import { Pool } from 'pg';
interface UserRow {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    timezone: string;
    password_hash: string;
    created_at: Date;
}
interface SessionRow {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
}
export declare class AuthRepository {
    private readonly db;
    constructor(db: Pool);
    getUserByEmail(email: string): Promise<UserRow | null>;
    getUserById(id: string): Promise<UserRow | null>;
    createUser(input: {
        email: string;
        name: string;
        passwordHash: string;
        timezone?: string;
    }): Promise<UserRow>;
    createSession(input: {
        id: string;
        userId: string;
        tokenHash: string;
        expiresAt: Date;
    }): Promise<void>;
    getSession(sessionId: string): Promise<SessionRow | null>;
    deleteSession(sessionId: string): Promise<void>;
    updateSessionExpiry(sessionId: string, expiresAt: Date): Promise<void>;
}
export {};
//# sourceMappingURL=auth.repository.d.ts.map