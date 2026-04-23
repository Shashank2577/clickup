import { Pool } from 'pg';
interface UserRow {
    id: string;
    email: string;
    name: string;
    avatar_url: string | null;
    timezone: string;
    password_hash: string;
    email_verified: boolean;
    created_at: Date;
}
interface SessionRow {
    id: string;
    user_id: string;
    token_hash: string;
    expires_at: Date;
    created_at: Date;
}
interface PasswordResetTokenRow {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    used_at: Date | null;
    created_at: Date;
}
interface EmailVerificationTokenRow {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    verified_at: Date | null;
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
    createPasswordResetToken(userId: string): Promise<PasswordResetTokenRow>;
    getPasswordResetToken(token: string): Promise<PasswordResetTokenRow | null>;
    markPasswordResetTokenUsed(id: string): Promise<void>;
    updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
    createEmailVerificationToken(userId: string): Promise<EmailVerificationTokenRow>;
    getEmailVerificationToken(token: string): Promise<EmailVerificationTokenRow | null>;
    markEmailVerified(userId: string, tokenId: string): Promise<void>;
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