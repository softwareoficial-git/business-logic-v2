"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.systemModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class SystemModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Autenticación
        Dispatcher_1.dispatcher.register('USER:login', {
            name: 'USER:login',
            description: 'Autentica un usuario y devuelve un token de sesión',
            requiredRole: 'GUEST'
        }, this.login);
        Dispatcher_1.dispatcher.register('USER:get-profile', {
            name: 'USER:get-profile',
            description: 'Obtiene el perfil del usuario autenticado',
            requiredRole: 'GUEST'
        }, this.getProfile);
        Dispatcher_1.dispatcher.register('USER:list-sessions', {
            name: 'USER:list-sessions',
            description: 'Lista todas las sesiones activas del usuario',
            requiredRole: 'DUEÑO'
        }, this.listSessions);
        Dispatcher_1.dispatcher.register('USER:logout', {
            name: 'USER:logout',
            description: 'Cierra la sesión actual',
            requiredRole: 'GUEST'
        }, this.logout);
        Dispatcher_1.dispatcher.register('USER:revoke-session', {
            name: 'USER:revoke-session',
            description: 'Revoca una sesión específica',
            requiredRole: 'DUEÑO'
        }, this.revokeSession);
        // Comando de descubrimiento para la auditoría
        Dispatcher_1.dispatcher.register('SYSTEM:list-commands', {
            name: 'SYSTEM:list-commands',
            description: 'Lista todos los comandos disponibles en el sistema',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.listCommands);
        // Setup de Tenant Completo (Para auditorías y Onboarding)
        Dispatcher_1.dispatcher.register('system.setup_tenant', {
            name: 'system.setup_tenant',
            description: 'Crea un tenant completo con usuarios y esquema base',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.setupTenant);
        // Rastreo de Visitas (Público)
        Dispatcher_1.dispatcher.register('system.track_visit', {
            name: 'system.track_visit',
            description: 'Rastrea visitas al sitio web automáticamente',
            requiredRole: 'GUEST'
        }, this.trackVisit);
        // Listar Eventos del Sistema
        Dispatcher_1.dispatcher.register('system.events.list', {
            name: 'system.events.list',
            description: 'Lista los eventos del sistema con filtrado',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.listEvents);
        // Estadísticas de Eventos
        Dispatcher_1.dispatcher.register('system.events.stats', {
            name: 'system.events.stats',
            description: 'Obtiene estadísticas agregadas de eventos',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.getEventStats);
        // Logs de Auditoría
        Dispatcher_1.dispatcher.register('system.audit.logs', {
            name: 'system.audit.logs',
            description: 'Obtiene el historial de auditoría de la aplicación',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.getAuditLogs);
    }
    async login(context, params) {
        try {
            const { username, password } = params;
            if (!username || !password) {
                return { success: false, message: 'Username and password are required', error: { code: 'VALIDATION_ERROR', message: 'Username and password are required' } };
            }
            // El comando USER:login es público, no debe usarse un token administrativo aquí
            const res = await InfraClient_1.infraClient.execute('USER:login', { username, password }, '');
            if (!res.success)
                return res;
            return {
                success: true,
                message: 'Login successful',
                data: { token: res.data.token, user: res.data.user }
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Login error' };
        }
    }
    async getProfile(context, params) {
        try {
            const res = await InfraClient_1.infraClient.execute('USER:get-profile', params, context.token);
            if (!res.success)
                return res;
            return {
                success: true,
                message: 'Profile retrieved successfully',
                data: { profile: res.data }
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Profile error' };
        }
    }
    async listSessions(context, params) {
        return InfraClient_1.infraClient.execute('USER:list-sessions', params, context.token);
    }
    async logout(context, params) {
        return InfraClient_1.infraClient.execute('USER:logout', { token: context.token }, context.token);
    }
    async revokeSession(context, params) {
        return InfraClient_1.infraClient.execute('USER:revoke-session', params, context.token);
    }
    async listCommands(context, params) {
        const commands = Dispatcher_1.dispatcher.getAvailableCommands();
        const catalog = {};
        commands.forEach(cmd => {
            const parts = cmd.name.split(/[:.]/);
            const domain = parts[0];
            const action = parts.slice(1).join('.');
            if (!catalog[domain])
                catalog[domain] = {};
            catalog[domain][action] = cmd;
        });
        return { success: true, message: 'Commands listed successfully', data: { commands: catalog } };
    }
    async setupTenant(context, params) {
        try {
            const businessName = params.name || 'Audit Business ' + Date.now();
            const clientRes = await InfraClient_1.infraClient.execute('APP:client-create', {
                nombre: businessName,
                sector: params.sector || 'General',
                config: { currency: 'USD', timezone: 'UTC', categories: ['General'], sectors: ['Main'] }
            }, context.token);
            if (!clientRes.success || !clientRes.data)
                return clientRes;
            const clientId = (clientRes.data.cliente || clientRes.data).id;
            const ownerRes = await InfraClient_1.infraClient.execute('CLIENT:user-create', {
                username: 'owner_' + clientId,
                password: 'password123',
                role: 'DUEÑO',
                clienteId: clientId
            }, context.token);
            const empRes = await InfraClient_1.infraClient.execute('CLIENT:user-create', {
                username: 'emp_' + clientId,
                password: 'password123',
                role: 'EMPLEADO',
                clienteId: clientId
            }, context.token);
            await InfraClient_1.infraClient.execute('CLIENT:user-permissions-update', {
                userId: ownerRes.data?.usuario?.id,
                clienteId: clientId,
                permissions: ['CLIENT:user-create', 'CLIENT:user-list', 'CLIENT:user-permissions-update', 'USER:write', 'USER:read-path', 'USER:read', 'USER:update-path', 'USER:push-item', 'USER:query-json']
            }, context.token);
            await InfraClient_1.infraClient.execute('CLIENT:user-permissions-update', {
                userId: empRes.data?.usuario?.id,
                clienteId: clientId,
                permissions: ['USER:read-path', 'USER:update-path', 'USER:push-item', 'USER:query-json', 'CLIENT:user-read']
            }, context.token);
            await InfraClient_1.infraClient.execute('USER:write', {
                clienteId: clientId,
                data: {
                    stock: [],
                    sales: { history: [] },
                    employees: [],
                    private_config: { subscription: { status: 'inactive' } },
                    business_definitions: { permissions: [], goal_types: [], tasks: [] }
                }
            }, context.token);
            return { success: true, message: 'Tenant setup completed successfully', data: { clientId } };
        }
        catch (e) {
            return { success: false, message: e.message || 'Setup error' };
        }
    }
    async trackVisit(context, params) {
        return InfraClient_1.infraClient.execute('ANALYTICS:track-visit', params, context.token || 'PUBLIC_TOKEN');
    }
    async listEvents(context, params) {
        return InfraClient_1.infraClient.execute('SYSTEM:events-list', params, context.token);
    }
    async getEventStats(context, params) {
        return InfraClient_1.infraClient.execute('SYSTEM:events-stats', params, context.token);
    }
    async getAuditLogs(context, params) {
        return InfraClient_1.infraClient.execute('SYSTEM:tenant-audit', { tenantId: context.tenantId, ...params }, context.token);
    }
}
exports.systemModule = new SystemModule();
