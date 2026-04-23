export interface ServiceRoute {
    prefix: string;
    target: string;
    isMutation: boolean;
    /**
     * The prefix stripped from req.originalUrl before forwarding to the upstream.
     * Defaults to `prefix` when not set (strips the full route prefix).
     * Set to '/api/v1' for services whose upstream uses /resource sub-routing
     * (e.g. identity-service which handles /auth/*, /users/*, /workspaces/*).
     */
    pathStripPrefix?: string;
}
export declare function buildServiceRoutes(): ServiceRoute[];
//# sourceMappingURL=proxy.config.d.ts.map