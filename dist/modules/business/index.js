"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.businessModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class BusinessModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Definir un Término de Negocio (Rol, Meta, Tarea)
        Dispatcher_1.dispatcher.register('business.define_term', {
            name: 'business.define_term',
            description: 'Define un término personalizado (tipo: permission, goal_type, task) para el negocio',
            requiredRole: 'DUEÑO',
            requiredPlan: 'free'
        }, this.defineTerm);
        // Obtener Configuración Global del Negocio
        Dispatcher_1.dispatcher.register('business.get_config', {
            name: 'business.get_config',
            description: 'Obtiene toda la configuración y definiciones del negocio',
            requiredRole: 'EMPLEADO',
            requiredPlan: 'free'
        }, this.getConfig);
        // Historial de Actividad del Negocio
        Dispatcher_1.dispatcher.register('business.activity_logs', {
            name: 'business.activity_logs',
            description: 'Obtiene la bitácora de cambios y acciones realizadas dentro del negocio',
            requiredRole: 'DUEÑO',
            requiredPlan: 'free'
        }, this.getActivityLogs);
    }
    async getActivityLogs(context, params) {
        try {
            // Consultamos los eventos registrados específicamente para este tenant
            const logs = await InfraClient_1.infraClient.queryJson(context.tenantId, 'system_events', {
                tenantId: context.tenantId
            }, context.token);
            return {
                success: true,
                message: 'Logs de actividad obtenidos',
                data: logs.data || []
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Error obteniendo logs de actividad' };
        }
    }
    async defineTerm(context, params) {
        try {
            const { def_type, def_key, def_label } = params;
            // Validación Estricta: Solo permitimos tipos predefinidos para mantener la integridad de la API
            const validTypes = ['permission', 'goal_type', 'task'];
            if (!def_type || !validTypes.includes(def_type)) {
                return {
                    success: false,
                    message: `Tipo inválido. Debe ser uno de: ${validTypes.join(', ')}`,
                    error: { code: 'INVALID_TYPE', message: 'El tipo de término no es válido' }
                };
            }
            if (!def_key || !def_label) {
                return {
                    success: false,
                    message: 'def_key y def_label son requeridos',
                    error: { code: 'MISSING_PARAMS', message: 'Faltan parámetros obligatorios' }
                };
            }
            // Mapeo de rutas para el blindaje de Infra
            const routeMap = {
                'permission': 'business_definitions.permissions',
                'goal_type': 'business_definitions.goal_types',
                'task': 'business_definitions.tasks'
            };
            const path = routeMap[def_type];
            // Ejecución Atómica: Usamos pushItem para evitar colisiones y asegurar la carga masiva
            const res = await InfraClient_1.infraClient.pushItem(context.tenantId, path, {
                def_key,
                def_label,
                createdAt: new Date().toISOString(),
                createdBy: context.userId
            }, context.token);
            if (!res.success)
                return res;
            return {
                success: true,
                message: `Término ${def_label} (${def_type}) definido exitosamente.`
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Error definiendo término' };
        }
    }
    async getConfig(context, params) {
        try {
            // Leemos la configuración completa del negocio
            const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'business_definitions', context.token);
            if (!res.success)
                return res;
            return {
                success: true,
                message: 'Configuración obtenida exitosamente',
                data: res.data
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Error obteniendo configuración' };
        }
    }
}
exports.businessModule = new BusinessModule();
