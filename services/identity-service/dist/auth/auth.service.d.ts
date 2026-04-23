import type { AuthContext } from '@clickup/sdk';
import type { AuthRepository } from './auth.repository.js';
export declare class AuthService {
    private readonly repository;
    constructor(repository: AuthRepository);
    register(input: {
        email: string;
        password: string;
        name: string;
        timezone?: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            emailVerified: boolean;
            createdAt: string;
        };
        token: string;
        emailVerificationToken: string;
    }>;
    login(input: {
        email: string;
        password: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            emailVerified: boolean;
            createdAt: string;
        };
        token: string;
    }>;
    logout(sessionId: string): Promise<void>;
    refresh(auth: AuthContext): Promise<{
        token: string;
    }>;
    forgotPassword(input: {
        email: string;
    }): Promise<{
        message: string;
        resetToken?: undefined;
    } | {
        message: string;
        resetToken: string;
    }>;
    resetPassword(input: {
        token: string;
        newPassword: string;
    }): Promise<{
        message: string;
    }>;
    verifyEmail(input: {
        token: string;
    }): Promise<{
        message: string;
    }>;
    resendVerification(input: {
        email: string;
    }): Promise<{
        message: string;
        emailVerificationToken?: undefined;
    } | {
        message: string;
        emailVerificationToken: string;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map