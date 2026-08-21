"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatcher = void 0;
const InfraClient_1 = require("./InfraClient");
class Dispatcher {
    constructor() {
        this.registry = new Map();
        this.PLAN_WEIGHTS = {
            free: 0,
            pro: 1,
            enterprise: 2,
        };
    }
    register(name, metadata, handler) {
        this.registry.set(name, { handler, metadata });
    }
    async logEvent(context, commandName, status, details = {}) {
        try {
            // Blindaje de Telemetría: Registro automático de cada acción en Infra
            // Usamos el token del sistema para asegurar que el log se registre incluso si el usuario no tiene permisos.
            const systemToken = process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN';
            await InfraClient_1.infraClient.execute("SYSTEM:log-event", {
                status,
                source: "BUSINESS_V2",
                command: commandName,
                tenantId: context.tenantId,
                userId: context.userId,
                ...details,
            }, systemToken);
        }
        catch (e) {
            console.error(`[TELEMETRY_ERROR] Failed to log event ${commandName}:`, e);
        }
    }
    async execute(commandName, params, context) {
        const command = this.registry.get(commandName);
        if (!command) {
            return {
                success: false,
                message: `Command ${commandName} not found`,
                error: {
                    code: "CMD_NOT_FOUND",
                    message: "El comando solicitado no existe",
                },
            };
        }
        const { handler, metadata } = command;
        // Bypass RBAC and Plan validation for profile verification used in middleware
        if (commandName === "USER:get-profile" && context.role === "GUEST") {
            try {
                const result = await handler(context, params);
                return result;
            }
            catch (error) {
                return { success: false, message: error.message };
            }
        }
        // 1. Validación de Rol (RBAC)
        if (!this.validateRole(context.role, metadata.requiredRole)) {
            return {
                success: false,
                message: `Acceso denegado. Este comando requiere el rol ${metadata.requiredRole}, pero tu rol actual es ${context.role}.`,
                error: {
                    code: "ROLE_INSUFFICIENT",
                    message: "No tienes el nivel de acceso necesario para esta operación.",
                    details: {
                        requiredRole: metadata.requiredRole,
                        currentRole: context.role,
                    },
                },
            };
        }
        // 2. Validación de Suscripción (Plan Guard)
        const requiredPlan = metadata.requiredPlan || "free";
        const userPlan = context.plan || "free";
        if ((this.PLAN_WEIGHTS[userPlan] || 0) <
            (this.PLAN_WEIGHTS[requiredPlan] || 0)) {
            return {
                success: false,
                message: `Este comando requiere un plan ${requiredPlan.toUpperCase()}. Tu plan actual es ${userPlan.toUpperCase()}.`,
                error: {
                    code: "PLAN_INSUFFICIENT",
                    message: "Tu plan actual no incluye esta funcionalidad.",
                    details: { requiredPlan, currentPlan: userPlan },
                },
            };
        }
        // 3. Validación de Suscripción (Billing Guard - Expiración)
        const subscriptionCheck = await this.checkSubscription(context);
        if (!subscriptionCheck.success) {
            return subscriptionCheck;
        }
        try {
            const result = await handler(context, params);
            // Registrar éxito en telemetría
            await this.logEvent(context, commandName, "SUCCESS", {
                params: params,
                message: result.message,
            });
            return result;
        }
        catch (error) {
            // Registrar error en telemetría
            await this.logEvent(context, commandName, "ERROR", {
                error: error.message,
                params: params,
            });
            return {
                success: false,
                message: error.message || "Internal Execution Error",
                error: { code: "EXECUTION_ERROR", message: error.message },
            };
        }
    }
    validateRole(userRole, requiredRole) {
        const hierarchy = {
            SISTEMA_ADMIN: 3,
            DUEÑO: 2,
            EMPLEADO: 1,
            PARTNER: 1,
            GUEST: 0,
        };
        return (hierarchy[userRole] || 0) >= (hierarchy[requiredRole] || 0);
    }
    async checkSubscription(context) {
        if (context.role === "SISTEMA_ADMIN")
            return { success: true, message: "Admin bypass" };
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, "private_config.subscription", context.token);
        if (!res.success)
            return { success: true, message: "No subscription set, trial active" };
        const sub = res.data;
        if (!sub)
            return { success: true, message: "No subscription set, trial active" };
        const now = new Date();
        const expiry = new Date(sub.expiry_date);
        if (now > expiry) {
            return {
                success: false,
                message: "Subscription expired",
                error: { code: "PLAN_EXPIRED", message: "Tu plan ha expirado" },
            };
        }
        return { success: true, message: "Subscription active" };
    }
    getAvailableCommands() {
        return Array.from(this.registry.values()).map((c) => c.metadata);
    }
}
exports.dispatcher = new Dispatcher();
