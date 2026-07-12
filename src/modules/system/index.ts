import { dispatcher, CommandHandler } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';

class SystemModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // Autenticación
    dispatcher.register('USER:login', {
      name: 'USER:login',
      description: 'Autentica un usuario y devuelve un token de sesión',
      requiredRole: 'GUEST'
    }, this.login);

    // Comando de descubrimiento para la auditoría
    dispatcher.register('SYSTEM:list-commands', {
      name: 'SYSTEM:list-commands',
      description: 'Lista todos los comandos disponibles en el sistema',
      requiredRole: 'SISTEMA_ADMIN'
    }, this.listCommands);

    // Setup de Tenant Completo (Para auditorías y Onboarding)
    dispatcher.register('system.setup_tenant', {
      name: 'system.setup_tenant',
      description: 'Crea un tenant completo con usuarios y esquema base',
      requiredRole: 'SISTEMA_ADMIN'
    }, this.setupTenant);

    // Rastreo de Visitas (Público)
    dispatcher.register('system.track_visit', {
      name: 'system.track_visit',
      description: 'Rastrea visitas al sitio web automáticamente',
      requiredRole: 'GUEST'
    }, this.trackVisit);

    // Listar Eventos del Sistema
    dispatcher.register('system.events.list', {
      name: 'system.events.list',
      description: 'Lista los eventos del sistema con filtrado',
      requiredRole: 'SISTEMA_ADMIN'
    }, this.listEvents);

    // Estadísticas de Eventos
    dispatcher.register('system.events.stats', {
      name: 'system.events.stats',
      description: 'Obtiene estadísticas agregadas de eventos',
      requiredRole: 'SISTEMA_ADMIN'
    }, this.getEventStats);

    // Logs de Auditoría
    dispatcher.register('system.audit.logs', {
      name: 'system.audit.logs',
      description: 'Obtiene el historial de auditoría de la aplicación',
      requiredRole: 'SISTEMA_ADMIN'
    }, this.getAuditLogs);
  }

  private async login(context: RequestContext, params: any): Promise<ServiceResponse> {
    try {
      const { username, password } = params;
      if (!username || !password) {
        return { success: false, message: 'Username and password are required', error: { code: 'VALIDATION_ERROR', message: 'Username and password are required' } };
      }
      const res = await infraClient.execute('USER:login', { username, password }, 'BOOTSTRAP_TOKEN');
      if (!res.success) return res;
      return {
        success: true,
        message: 'Login successful',
        data: { token: res.data.token, user: res.data.usuario }
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Login error' };
    }
  }

  private async listCommands(context: RequestContext, params: any): Promise<ServiceResponse> {
    const commands = dispatcher.getAvailableCommands();
    const catalog: Record<string, any> = {};
    commands.forEach(cmd => {
      const parts = cmd.name.split(/[:.]/);
      const domain = parts[0];
      const action = parts.slice(1).join('.');
      if (!catalog[domain]) catalog[domain] = {};
      catalog[domain][action] = cmd;
    });
    return { success: true, message: 'Commands listed successfully', data: { commands: catalog } };
  }

  private async setupTenant(context: RequestContext, params: any): Promise<ServiceResponse> {
    try {
      const businessName = params.name || 'Audit Business ' + Date.now();
      const clientRes = await infraClient.execute('APP:client-create', {
        nombre: businessName,
        sector: params.sector || 'General',
        config: { currency: 'USD', timezone: 'UTC', categories: ['General'], sectors: ['Main'] }
      }, context.token);

      if (!clientRes.success || !clientRes.data) return clientRes;
      const clientId = (clientRes.data.cliente || clientRes.data).id;

      const ownerRes = await infraClient.execute('CLIENT:user-create', {
        username: 'owner_' + clientId,
        password: 'password123',
        role: 'DUEÑO',
        clienteId: clientId
      }, context.token);

      const empRes = await infraClient.execute('CLIENT:user-create', {
        username: 'emp_' + clientId,
        password: 'password123',
        role: 'EMPLEADO',
        clienteId: clientId
      }, context.token);

      await infraClient.execute('CLIENT:user-permissions-update', {
        userId: ownerRes.data?.usuario?.id,
        clienteId: clientId,
        permissions: ['CLIENT:user-create', 'CLIENT:user-list', 'CLIENT:user-permissions-update', 'USER:write', 'USER:read-path', 'USER:read', 'USER:update-path', 'USER:push-item', 'USER:query-json']
      }, context.token);

      await infraClient.execute('CLIENT:user-permissions-update', {
        userId: empRes.data?.usuario?.id,
        clienteId: clientId,
        permissions: ['USER:read-path', 'USER:update-path', 'USER:push-item', 'USER:query-json', 'CLIENT:user-read']
      }, context.token);

      await infraClient.execute('USER:write', {
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
    } catch (e: any) {
      return { success: false, message: e.message || 'Setup error' };
    }
  }

  private async trackVisit(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.execute('ANALYTICS:track-visit', params, context.token || 'PUBLIC_TOKEN');
  }

  private async listEvents(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.execute('SYSTEM:events-list', params, context.token);
  }

  private async getEventStats(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.execute('SYSTEM:events-stats', params, context.token);
  }

  private async getAuditLogs(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.execute('SYSTEM:tenant-audit', { tenantId: context.tenantId, ...params }, context.token);
  }
}

export const systemModule = new SystemModule();
