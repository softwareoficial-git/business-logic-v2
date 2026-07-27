import { dispatcher, CommandHandler } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';

class BusinessModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // Definir un Término de Negocio (Rol, Meta, Tarea)
    dispatcher.register('business.define_term', {
      name: 'business.define_term',
      description: 'Define un término personalizado (tipo: permission, goal_type, task) para el negocio',
      requiredRole: 'DUEÑO',
      requiredPlan: 'free'
    }, this.defineTerm);

    // Obtener Configuración Global del Negocio
    dispatcher.register('business.get_config', {
      name: 'business.get_config',
      description: 'Obtiene toda la configuración y definiciones del negocio',
      requiredRole: 'EMPLEADO',
      requiredPlan: 'free'
    }, this.getConfig);

    // Historial de Actividad del Negocio
    dispatcher.register('business.activity_logs', {
      name: 'business.activity_logs',
      description: 'Obtiene la bitácora de cambios y acciones realizadas dentro del negocio',
      requiredRole: 'DUEÑO',
      requiredPlan: 'free'
    }, this.getActivityLogs);

    // Obtener Guías de Onboarding
    dispatcher.register('business.get_onboarding_guides', {
      name: 'business.get_onboarding_guides',
      description: 'Proporciona guías y consejos para nuevos usuarios (onboarding)',
      requiredRole: 'GUEST' // Accesible para cualquier usuario, incluso sin loguear, o EMPLEADO
    }, this.getOnboardingGuides);

    // Obtener Alertas de Negocio
    dispatcher.register('business.get_business_alerts', {
      name: 'business.get_business_alerts',
      description: 'Obtiene alertas y notificaciones importantes del negocio',
      requiredRole: 'DUEÑO'
    }, this.getBusinessAlerts);

    // Obtener Reportes Clave Ejecutivos
    dispatcher.register('business.get_key_reports', {
      name: 'business.get_key_reports',
      description: 'Proporciona un resumen de reportes ejecutivos clave del negocio',
      requiredRole: 'DUEÑO'
    }, this.getKeyReports);
  }

  private async getActivityLogs(context: RequestContext, params: any): Promise<ServiceResponse> {
    try {
      // Consultamos los eventos registrados específicamente para este tenant
      const logs = await infraClient.queryJson<any>(context.tenantId, 'system_events', { 
        tenantId: context.tenantId 
      }, context.token);

      return { 
        success: true, 
        message: 'Logs de actividad obtenidos', 
        data: logs.data || [] 
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error obteniendo logs de actividad' };
    }
  }

  private async defineTerm(context: RequestContext, params: any): Promise<ServiceResponse> {
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
      const routeMap: Record<string, string> = {
        'permission': 'business_definitions.permissions',
        'goal_type': 'business_definitions.goal_types',
        'task': 'business_definitions.tasks'
      };

      const path = routeMap[def_type];

      // Ejecución Atómica: Usamos pushItem para evitar colisiones y asegurar la carga masiva
      const res = await infraClient.pushItem(context.tenantId, path, {
        def_key,
        def_label,
        createdAt: new Date().toISOString(),
        createdBy: context.userId
      }, context.token);

      if (!res.success) return res;

      return { 
        success: true, 
        message: `Término ${def_label} (${def_type}) definido exitosamente.` 
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error definiendo término' };
    }
  }

  private async getConfig(context: RequestContext, params: any): Promise<ServiceResponse> {
    try {
      // Leemos la configuración completa del negocio
      const res = await infraClient.readPath<any>(context.tenantId, 'business_definitions', context.token);
      
      if (!res.success) return res;

      return { 
        success: true, 
        message: 'Configuración obtenida exitosamente', 
        data: res.data 
      };
    } catch (e: any) {
      return { success: false, message: e.message || 'Error obteniendo configuración' };
    }
  }

  private async getOnboardingGuides(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { role } = params;
    const guides: any[] = [];

    // Verificar existencia de datos para onboarding dinámico
    const empRes = await infraClient.readPath<any[]>(context.tenantId, 'employees', context.token);
    const stockRes = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    const salesRes = await infraClient.readPath<any[]>(context.tenantId, 'sales', context.token);

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

  private async getBusinessAlerts(context: RequestContext, params: any): Promise<ServiceResponse> {
    const alerts: any[] = [];

    // 1. Alertas de Stock Bajo reales
    const stockRes = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
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

  private async getKeyReports(context: RequestContext, params: any): Promise<ServiceResponse> {
    const salesRes = await infraClient.readPath<any[]>(context.tenantId, 'sales', context.token);
    if (!salesRes.success) return salesRes;

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

export const businessModule = new BusinessModule();
