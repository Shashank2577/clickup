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
            createdAt: string;
        };
        token: string;
    }>;
    login(input: {
        email: string;
        password: string;
    }): Promise<{
        user: {
            id: string;
            email: string;
            name: string;
            createdAt: string;
        };
        token: string;
    }>;
    logout(sessionId: string): Promise<void>;
    refresh(auth: AuthContext): Promise<{
        token: string;
    }>;
}
//# sourceMappingURL=auth.service.d.ts.map