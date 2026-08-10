"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
const mercadopago_1 = require("mercadopago");
class BillingModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // ...
        // Obtener Configuración de Pasarela
        Dispatcher_1.dispatcher.register('billing.get-config', {
            name: 'billing.get-config',
            description: 'Obtiene las credenciales de la pasarela de pago',
            requiredRole: 'DUEÑO'
        }, this.getGatewayConfig);
        // Generar link de pago para plataforma
        Dispatcher_1.dispatcher.register('billing.create-preference', {
            name: 'billing.create-preference',
            description: 'Genera preferencia de pago para plan PRO',
            requiredRole: 'DUEÑO'
        }, this.createSubscriptionPreference);
    }
    // ... (métodos configureGateway, getGatewayConfig, initSubscription, extendSubscription, getStatus existentes)
    async createSubscriptionPreference(context, params) {
        const { plan, amount } = params;
        // 1. Obtener credenciales de plataforma (tenantId 0)
        const configRes = await this.getGatewayConfig(context, { tenant_id: 0, gateway_type: 'mercadopago' });
        if (!configRes.success || !configRes.data || configRes.data.length === 0) {
            return { success: false, message: 'Configuración de plataforma no encontrada' };
        }
        const configData = configRes.data[0].config_data;
        const client = new mercadopago_1.MercadoPagoConfig({ accessToken: configData.access_token });
        const preference = new mercadopago_1.Preference(client);
        // 2. Crear preferencia
        const result = await preference.create({
            body: {
                items: [{ id: plan, title: `Plan ${plan}`, quantity: 1, unit_price: amount }],
                back_urls: { success: `${process.env.FRONTEND_URL}/profile` },
                external_reference: JSON.stringify({ tenantId: context.tenantId, plan })
            }
        });
        return { success: true, message: 'Preferencia creada', data: { init_point: result.init_point } };
    }
    // ... (dentro de handlePaymentNotification)
    async handlePaymentNotification(tenantId, paymentData, headers) {
        console.log(`[DEBUG] Buscando config para tenant: ${tenantId}`);
        // 1. Obtener credenciales del tenant usando un contexto con token de sistema
        const systemContext = { token: process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN' };
        const configRes = await this.getGatewayConfig(systemContext, {
            tenant_id: tenantId,
            gateway_type: 'mercadopago'
        });
        if (!configRes.success || !configRes.data || configRes.data.length === 0) {
            throw new Error('Configuración no encontrada para el tenant');
        }
        const config = configRes.data[0].config_data;
        const secret = config.webhook_secret;
        // 2. Validar firma real con SDK
        const signature = headers['x-signature'];
        const requestId = headers['x-request-id'];
        mercadopago_1.WebhookSignatureValidator.validate({
            xSignature: signature,
            xRequestId: requestId,
            dataId: paymentData.data?.id,
            secret: secret
        });
        // 3. Procesar pago...
        const externalRef = JSON.parse(paymentData.data?.external_reference || '{}');
        if (externalRef.plan === 'pro') {
            await this.initSubscription({}, {
                clienteId: tenantId,
                days: 30,
                plan: 'pro'
            });
            console.log(`[BILLING] Suscripción activada para tenant ${tenantId}`);
        }
    }
    async configureGateway(context, params) {
        const { tenant_id, gateway_type, config_data, is_active, environment } = params;
        // Si no es admin, forzamos que el tenant_id sea el suyo
        const targetTenant = context.role === 'SUPER_ADMIN' ? tenant_id : context.tenantId;
        return InfraClient_1.infraClient.execute('BILLING:config', {
            tenant_id: targetTenant,
            gateway_type,
            config_data,
            is_active,
            environment
        }, context.token);
    }
    async getGatewayConfig(context, params) {
        const { tenant_id, gateway_type } = params;
        // Si el tenant_id solicitado es 0 (plataforma), permitimos el acceso sin restricción de rol 
        // ya que es necesario para el procesamiento de webhooks internos.
        const targetTenant = tenant_id === 0 ? 0 : (context.role === 'SUPER_ADMIN' ? tenant_id : context.tenantId);
        return InfraClient_1.infraClient.execute('BILLING:get-config', {
            tenant_id: targetTenant,
            gateway_type
        }, context.token || 'SYSTEM_TOKEN');
    }
    // Obtener definición de planes
    async getPlans(context) {
        return InfraClient_1.infraClient.execute('BILLING:list-plans', {}, context.token || 'SYSTEM_TOKEN');
    }
    // Obtener detalles de un plan específico
    async getPlanDetails(context, planId) {
        const plansRes = await this.getPlans(context);
        if (!plansRes.success)
            throw new Error('No se pudieron obtener los planes');
        return plansRes.data.find((p) => p.id === planId);
    }
    // Inicializar o actualizar suscripción (actualiza private_config en clientes)
    async activatePlan(context, tenantId, planId) {
        const plan = await this.getPlanDetails(context, planId);
        if (!plan)
            return { success: false, message: 'Plan no válido' };
        // Mapeamos a la lógica existente de initSubscription
        return await this.initSubscription(context, {
            clienteId: tenantId,
            days: plan.duration_days,
            plan: plan.id
        });
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
