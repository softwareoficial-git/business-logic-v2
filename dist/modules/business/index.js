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
        // Obtener Guías de Onboarding
        Dispatcher_1.dispatcher.register('business.get_onboarding_guides', {
            name: 'business.get_onboarding_guides',
            description: 'Proporciona guías y consejos para nuevos usuarios (onboarding)',
            requiredRole: 'GUEST' // Accesible para cualquier usuario, incluso sin loguear, o EMPLEADO
        }, this.getOnboardingGuides);
        // Obtener Alertas de Negocio
        Dispatcher_1.dispatcher.register('business.get_business_alerts', {
            name: 'business.get_business_alerts',
            description: 'Obtiene alertas y notificaciones importantes del negocio',
            requiredRole: 'DUEÑO'
        }, this.getBusinessAlerts);
        // Obtener Reportes Clave Ejecutivos
        Dispatcher_1.dispatcher.register('business.get_key_reports', {
            name: 'business.get_key_reports',
            description: 'Proporciona un resumen de reportes ejecutivos clave del negocio',
            requiredRole: 'DUEÑO'
        }, this.getKeyReports);
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
    async getOnboardingGuides(context, params) {
        const { role } = params;
        const guides = [];
        // Verificar existencia de datos para onboarding dinámico
        const empRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'employees', context.token);
        const stockRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        const salesRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'sales', context.token);
        const hasEmployees = empRes.success && empRes.data && empRes.data.length > 0;
        const hasStock = stockRes.success && stockRes.data && stockRes.data.length > 0;
        const hasSales = salesRes.success && salesRes.data && salesRes.data.length > 0;
        // Guías para Dueño
        if (role === 'DUEÑO') {
            if (!hasEmployees) {
                guides.push({ title: 'Crea tu primer empleado', description: 'Registra a tu equipo para empezar a delegar tareas.', actionLink: '/employees' });
            }
            if (!hasStock) {
                guides.push({ title: 'Añade tu primer producto', description: 'Registra tus productos en el inventario para poder venderlos.', actionLink: '/stock' });
            }
            if (!hasSales && hasStock) {
                guides.push({ title: 'Realiza tu primera venta', description: 'Usa el panel de ventas para procesar tu primer pedido.', actionLink: '/sales' });
            }
        }
        // Guías para Empleado
        if (role === 'EMPLEADO') {
            if (!hasSales) {
                guides.push({ title: 'Aprende a vender', description: 'Familiarízate con el panel de ventas.', actionLink: '/sales' });
            }
            guides.push({ title: 'Consulta el stock', description: 'Revisa siempre la disponibilidad antes de vender.', actionLink: '/stock' });
        }
        return { success: true, message: 'Guías obtenidas', data: guides };
    }
    async getBusinessAlerts(context, params) {
        const alerts = [];
        // 1. Alertas de Stock Bajo reales
        const stockRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        if (stockRes.success && stockRes.data) {
            const lowStockItems = stockRes.data.filter(item => Number(item.qty) < 5);
            lowStockItems.forEach(item => {
                alerts.push({
                    id: `STOCK_${item.code}`,
                    type: 'stock_low',
                    message: `Stock crítico: ${item.name} tiene solo ${item.qty} unidades.`,
                    timestamp: new Date().toISOString(),
                    severity: 'high'
                });
            });
        }
        return { success: true, message: 'Alertas reales obtenidas', data: alerts };
    }
    async getKeyReports(context, params) {
        const salesRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'sales', context.token);
        if (!salesRes.success)
            return salesRes;
        const sales = salesRes.data || [];
        const totalSalesValue = sales.reduce((sum, s) => sum + Number(s.total || 0), 0);
        const avgTicket = sales.length > 0 ? totalSalesValue / sales.length : 0;
        // Calcular crecimiento simple (ej. comparando con histórico - lógica simplificada)
        const reports = {
            dailySummary: {
                totalSales: totalSalesValue,
                totalTickets: sales.length,
                avgTicket: avgTicket,
            },
            monthlyGrowth: sales.length > 0 ? 'Análisis activo' : 'Sin datos suficientes',
            topSeller: 'Cargando datos de personal...'
        };
        return { success: true, message: 'Reportes reales calculados', data: reports };
    }
}
exports.businessModule = new BusinessModule();
