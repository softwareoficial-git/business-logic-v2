import { dispatcher } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';
import { MercadoPagoConfig, Preference, WebhookSignatureValidator } from 'mercadopago';

class BillingModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // ...
    // Obtener Configuración de Pasarela
    dispatcher.register('BILLING:get-config', {
      name: 'BILLING:get-config',
      description: 'Obtiene las credenciales de la pasarela de pago',
      requiredRole: 'DUEÑO'
    }, (ctx, params) => this.getGatewayConfig(ctx, params));

    // Configurar Pasarela
    dispatcher.register('BILLING:config', {
      name: 'BILLING:config',
      description: 'Configura las credenciales de la pasarela de pago',
      requiredRole: 'DUEÑO'
    }, (ctx, params) => this.configureGateway(ctx, params));

    // Generar link de pago para plataforma
    dispatcher.register('BILLING:create-preference', {
      name: 'BILLING:create-preference',
      description: 'Genera preferencia de pago para plan PRO',
      requiredRole: 'DUEÑO'
    }, (ctx, params) => this.createSubscriptionPreference(ctx, params));
  }

  // ... (métodos configureGateway, getGatewayConfig, initSubscription, extendSubscription, getStatus existentes)

  private createSubscriptionPreference = async (context: RequestContext, params: any): Promise<ServiceResponse> => {
    console.log('[DEBUG] Executing createSubscriptionPreference, this:', this);
    if (!this) {
        throw new Error('[DEBUG] "this" is undefined in createSubscriptionPreference');
    }
    const { plan, amount } = params;
    
    // 1. Obtener credenciales de plataforma (tenantId 0)
    console.log('[DEBUG] calling getGatewayConfig...');
    const configRes = await this.getGatewayConfig(context, { tenant_id: 0, gateway_type: 'mercadopago' });
    console.log('[DEBUG] getGatewayConfig result:', JSON.stringify(configRes, null, 2));
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

// ... (dentro de handlePaymentNotification)
  public handlePaymentNotification = async (tenantId: number, paymentData: any, headers: any): Promise<void> => {
    console.log(`[DEBUG] Buscando config para tenant: ${tenantId}`);
    
    // 1. Obtener credenciales del tenant usando un contexto con token de sistema
    const systemContext = { token: process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN' } as RequestContext;
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

    WebhookSignatureValidator.validate({
        xSignature: signature,
        xRequestId: requestId,
        dataId: paymentData.data?.id,
        secret: secret
    });

    // 3. Procesar pago...
    const externalRef = JSON.parse(paymentData.data?.external_reference || '{}');
    if (externalRef.plan === 'pro') {
        await this.initSubscription({} as RequestContext, { 
          clienteId: tenantId, 
          days: 30, 
          plan: 'pro' 
        });
        console.log(`[BILLING] Suscripción activada para tenant ${tenantId}`);
    }
  }

private configureGateway = async (context: RequestContext, params: any): Promise<ServiceResponse> => {
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

private getGatewayConfig = async (context: RequestContext, params: any): Promise<ServiceResponse> => {
  const { tenant_id, gateway_type } = params;

  // Si el tenant_id solicitado es 0 (plataforma), permitimos el acceso sin restricción de rol 
  // ya que es necesario para el procesamiento de webhooks internos.
  const targetTenant = tenant_id === 0 ? 0 : (context.role === 'SUPER_ADMIN' ? tenant_id : context.tenantId);
  
  // Usar el token del sistema si se consulta la plataforma
  const token = targetTenant === 0 ? (process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN') : context.token;

  return infraClient.execute('BILLING:get-config', {
    tenant_id: targetTenant,
    gateway_type
  }, token);
}

  // Obtener definición de planes
  public async getPlans(context: RequestContext): Promise<ServiceResponse> {
    return infraClient.execute('BILLING:list-plans', {}, context.token || 'SYSTEM_TOKEN');
  }

  // Obtener detalles de un plan específico
  public async getPlanDetails(context: RequestContext, planId: string): Promise<any> {
    const plansRes = await this.getPlans(context);
    if (!plansRes.success) throw new Error('No se pudieron obtener los planes');
    return plansRes.data.find((p: any) => p.id === planId);
  }

  // Inicializar o actualizar suscripción (actualiza private_config en clientes)
  public async activatePlan(context: RequestContext, tenantId: number, planId: string): Promise<ServiceResponse> {
    const plan = await this.getPlanDetails(context, planId);
    if (!plan) return { success: false, message: 'Plan no válido' };

    // Mapeamos a la lógica existente de initSubscription
    return await this.initSubscription(context, { 
      clienteId: tenantId, 
      days: plan.duration_days, 
      plan: plan.id 
    });
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
