"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class CRMModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Crear Cliente
        Dispatcher_1.dispatcher.register('customer.create', {
            name: 'customer.create',
            description: 'Registra un nuevo cliente en la base de datos del negocio',
            requiredRole: 'EMPLEADO',
            requiredPlan: 'free'
        }, this.createCustomer);
        // Listar Clientes
        Dispatcher_1.dispatcher.register('customer.list', {
            name: 'customer.list',
            description: 'Obtiene la lista de clientes con filtrado básico',
            requiredRole: 'EMPLEADO',
            requiredPlan: 'free'
        }, this.listCustomers);
        // Historial del Cliente
        Dispatcher_1.dispatcher.register('customer.get_history', {
            name: 'customer.get_history',
            description: 'Obtiene todas las interacciones y compras de un cliente específico',
            requiredRole: 'EMPLEADO',
            requiredPlan: 'free'
        }, this.getCustomerHistory);
    }
    async createCustomer(context, params) {
        try {
            const { name, phone, email, address } = params;
            if (!name || !phone) {
                return { success: false, message: 'Nombre y teléfono son requeridos' };
            }
            const customer = {
                id: `CUST-${Date.now()}`,
                name,
                phone,
                email,
                address,
                createdAt: new Date().toISOString(),
                tenantId: context.tenantId
            };
            return InfraClient_1.infraClient.pushItem(context.tenantId, 'customers', customer, context.token);
        }
        catch (e) {
            return { success: false, message: e.message || 'Error creando cliente' };
        }
    }
    async listCustomers(context, params) {
        try {
            return await InfraClient_1.infraClient.readPath(context.tenantId, 'customers', context.token);
        }
        catch (e) {
            return { success: false, message: e.message || 'Error listando clientes' };
        }
    }
    async getCustomerHistory(context, params) {
        try {
            const { customerId } = params;
            if (!customerId)
                return { success: false, message: 'customerId es requerido' };
            // 1. Validar que el cliente pertenece al tenant actual
            const customerCheck = await InfraClient_1.infraClient.readPath(context.tenantId, `customers/${customerId}`, context.token);
            if (!customerCheck.success || !customerCheck.data) {
                return { success: false, message: 'Cliente no encontrado o acceso denegado' };
            }
            // Buscamos todas las ventas donde el clienteId coincida
            const sales = await InfraClient_1.infraClient.queryJson(context.tenantId, 'sales.history', { customerId }, context.token);
            return {
                success: true,
                message: 'Historial obtenido',
                data: sales.data || []
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Error obteniendo historial' };
        }
    }
}
exports.crmModule = new CRMModule();
