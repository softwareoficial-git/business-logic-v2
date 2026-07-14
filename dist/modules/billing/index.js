"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class BillingModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Inicializar Suscripción (Trial)
        Dispatcher_1.dispatcher.register('billing.init', {
            name: 'billing.init',
            description: 'Inicializa el periodo de prueba o suscripción para el cliente',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.initSubscription);
        // Extender Suscripción
        Dispatcher_1.dispatcher.register('billing.extend', {
            name: 'billing.extend',
            description: 'Añade días adicionales a la suscripción actual',
            requiredRole: 'SISTEMA_ADMIN'
        }, this.extendSubscription);
        // Consultar Estado de Cuenta
        Dispatcher_1.dispatcher.register('billing.status', {
            name: 'billing.status',
            description: 'Obtiene la fecha de expiración y estado del plan',
            requiredRole: 'DUEÑO'
        }, this.getStatus);
    }
    async initSubscription(context, params) {
        const { clienteId, days = 30, plan = 'basic' } = params;
        if (!clienteId)
            return { success: false, message: 'clienteId es requerido' };
        const startDate = new Date();
        const expiryDate = new Date();
        expiryDate.setDate(startDate.getDate() + days);
        const subscriptionData = {
            status: 'active',
            start_date: startDate.toISOString(),
            expiry_date: expiryDate.toISOString(),
            cycle_days: days,
            plan: plan
        };
        // Guardamos en private_config para que el cliente no pueda modificarlo vía USER:update-path
        return InfraClient_1.infraClient.updatePath(clienteId, 'private_config.subscription', subscriptionData, context.token);
    }
    async extendSubscription(context, params) {
        const { clienteId, addDays } = params;
        if (!clienteId || !addDays)
            return { success: false, message: 'clienteId y addDays son requeridos' };
        const res = await InfraClient_1.infraClient.readPath(clienteId, 'private_config.subscription', context.token);
        if (!res.success)
            return res;
        const sub = res.data;
        if (!sub || !sub.expiry_date) {
            return { success: false, message: 'No se encontró una suscripción activa para extender' };
        }
        const currentExpiry = new Date(sub.expiry_date);
        currentExpiry.setDate(currentExpiry.getDate() + addDays);
        return InfraClient_1.infraClient.updatePath(clienteId, 'private_config.subscription', {
            ...sub,
            expiry_date: currentExpiry.toISOString()
        }, context.token);
    }
    async getStatus(context, params) {
        return InfraClient_1.infraClient.readPath(context.tenantId, 'private_config.subscription', context.token);
    }
}
exports.billingModule = new BillingModule();
