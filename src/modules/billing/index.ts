import { dispatcher } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';
import { MercadoPagoConfig, Preference } from 'mercadopago';

class BillingModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // ...
    // Obtener Configuración de Pasarela
    dispatcher.register('billing.get-config', {
      name: 'billing.get-config',
      description: 'Obtiene las credenciales de la pasarela de pago',
      requiredRole: 'DUEÑO'
    }, this.getGatewayConfig);

    // Generar link de pago para plataforma
    dispatcher.register('billing.create-preference', {
      name: 'billing.create-preference',
      description: 'Genera preferencia de pago para plan PRO',
      requiredRole: 'DUEÑO'
    }, this.createSubscriptionPreference);
  }

  // ... (métodos configureGateway, getGatewayConfig, initSubscription, extendSubscription, getStatus existentes)

  private async createSubscriptionPreference(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { plan, amount } = params;
    
    // 1. Obtener credenciales de plataforma (tenantId 0)
    const configRes = await this.getGatewayConfig(context, { tenant_id: 0, gateway_type: 'mercadopago' });
    if (!configRes.success || !configRes.data || configRes.data.length === 0) {
        return { success: false, message: 'Configuración de plataforma no encontrada' };
    }

    const configData = configRes.data[0].config_data;
    const client = new MercadoPagoConfig({ accessToken: configData.access_token });
    const preference = new Preference(client);

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

  public async handlePaymentNotification(tenantId: number, paymentData: any, headers: any): Promise<void> {
    // 1. Obtener credenciales del tenant para validar firma
    // Usamos context vacío y payload directo
    const configRes = await this.getGatewayConfig({} as RequestContext, {
        tenant_id: tenantId,
        gateway_type: 'mercadopago'
    });

    if (!configRes.success || !configRes.data || configRes.data.length === 0) {
        console.error(`[WEBHOOK_ERROR] No se encontró config para tenant ${tenantId}`);
        throw new Error('Configuración no encontrada para el tenant');
    }

    const config = configRes.data[0].config_data;
    const secret = config.webhook_secret;

    // 2. Validar firma (SDK de Mercado Pago)
    // Nota: Requerimos importar Webhook de mercadopago
    const isValid = true; // Placeholder: Aquí iría Webhook.validateSignature()
    
    if (!isValid) throw new Error('Firma inválida');

    // 3. Procesar pago y actualizar suscripción
    // Asumimos que el pago es para suscripción PRO si el external_reference coincide
    const externalRef = JSON.parse(paymentData.data?.external_reference || '{}');
    if (externalRef.plan === 'pro') {
        await this.initSubscription({} as RequestContext, { 
          clienteId: tenantId, 
          days: 30, 
          plan: 'pro' 
        });
        console.log(`[BILLING] Suscripción actualizada a PRO para tenant ${tenantId}`);
    }
  }

private async configureGateway(context: RequestContext, params: any): Promise<ServiceResponse> {
  const { tenant_id, gateway_type, config_data, is_active, environment } = params;

  // Si no es admin, forzamos que el tenant_id sea el suyo
  const targetTenant = context.role === 'SUPER_ADMIN' ? tenant_id : context.tenantId;

  return infraClient.execute('BILLING:config', {
    tenant_id: targetTenant,
    gateway_type,
    config_data,
    is_active,
    environment
  }, context.token);
}

private async getGatewayConfig(context: RequestContext, params: any): Promise<ServiceResponse> {
  const { tenant_id, gateway_type } = params;
  const targetTenant = context.role === 'SUPER_ADMIN' ? tenant_id : context.tenantId;

  return infraClient.execute('BILLING:get-config', {
    tenant_id: targetTenant,
    gateway_type
  }, context.token);
}

  private async initSubscription(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { clienteId, days = 30, plan = 'basic' } = params;
    if (!clienteId) return { success: false, message: 'clienteId es requerido' };

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
    return infraClient.updatePath(clienteId, 'private_config.subscription', subscriptionData, context.token);
  }

  private async extendSubscription(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { clienteId, addDays } = params;
    if (!clienteId || !addDays) return { success: false, message: 'clienteId y addDays son requeridos' };

    const res = await infraClient.readPath<any>(clienteId, 'private_config.subscription', context.token);
    if (!res.success) return res;

    const sub = res.data;
    if (!sub || !sub.expiry_date) {
      return { success: false, message: 'No se encontró una suscripción activa para extender' };
    }

    const currentExpiry = new Date(sub.expiry_date);
    currentExpiry.setDate(currentExpiry.getDate() + addDays);

    return infraClient.updatePath(clienteId, 'private_config.subscription', {
      ...sub,
      expiry_date: currentExpiry.toISOString()
    }, context.token);
  }

  private async getStatus(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.readPath(context.tenantId, 'private_config.subscription', context.token);
  }
}

export const billingModule = new BillingModule();
