import { dispatcher, CommandHandler } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';

class StaffModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // Crear Empleado
    dispatcher.register('staff.create', {
      name: 'staff.create',
      description: 'Crea un nuevo empleado (Humano o Bot) vinculado a la empresa',
      requiredRole: 'DUEÑO'
    }, this.createEmployee);

    // Listar Empleados
    dispatcher.register('staff.list', {
      name: 'staff.list',
      description: 'Lista todos los empleados de la empresa',
      requiredRole: 'DUEÑO'
    }, this.listEmployees);

    // Definir Término de Negocio (Permiso, Meta, Tarea)
    dispatcher.register('staff.define_term', {
      name: 'staff.define_term',
      description: 'Define un término personalizado (tipo: permission, goal_type, task)',
      requiredRole: 'DUEÑO'
    }, this.defineTerm);

    // Asignar Meta de Rendimiento
    dispatcher.register('staff.set_goal', {
      name: 'staff.set_goal',
      description: 'Asigna una meta de rendimiento a un empleado',
      requiredRole: 'DUEÑO'
    }, this.setGoal);

    // Actualizar Permisos
    dispatcher.register('staff.update_permissions', {
      name: 'staff.update_permissions',
      description: 'Actualiza los permisos granulares de un empleado',
      requiredRole: 'DUEÑO'
    }, this.updatePermissions);

    // Eliminar Empleado
    dispatcher.register('staff.delete', {
      name: 'staff.delete',
      description: 'Elimina un empleado de la empresa',
      requiredRole: 'DUEÑO'
    }, this.deleteEmployee);

    // Monitoreo de Actividad
    dispatcher.register('staff.get_employee_activity', {
      name: 'staff.get_employee_activity',
      description: 'Consulta la línea de tiempo de actividades de un empleado',
      requiredRole: 'DUEÑO'
    }, this.getEmployeeActivity);
  }

  // ... (métodos existentes createEmployee, defineTerm, setGoal, listEmployees, updatePermissions, deleteEmployee)

  private async getEmployeeActivity(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { userId, limit, offset, debug } = params;

    // Usar el nuevo comando USER:audit-team que permite auditoría segura para DUEÑOS
    const res = await infraClient.execute('USER:audit-team', {
      userId,
      limit: limit || 100,
      offset: offset || 0
    }, context.token);

    if (!res.success) return res;

    // DEBUG: Inspeccionar qué devuelve exactamente el comando
    console.log(`[DEBUG_AUDIT] Timeline bruto recibido:`, JSON.stringify(res.data.timeline, null, 2));

    // Si modo debug, devolver datos crudos
    if (debug) {
      return { success: true, message: 'Logs crudos obtenidos', data: res.data.timeline };
    }

    // Transformar y organizar los datos para el frontend
    const timeline = res.data.timeline || [];
    
    // Agrupamos por ID de venta para consolidar los fragmentos
    const ventasConsolidadas: any = {};
    const otrosEventos: any[] = [];

    timeline.forEach((log: any) => {
      // Intentamos identificar una venta por el sale_id presente en el payload
      const saleId = log.payload?.item?.sale_id || log.payload?.item?.id;
      
      if (saleId) {
        if (!ventasConsolidadas[saleId]) {
          ventasConsolidadas[saleId] = {
            fecha: (typeof log.created_at === 'string' ? log.created_at : new Date().toISOString()),
            comando: 'Venta realizada',
            estatus: 'SUCCESS',
            resumen: `Venta ID: ${saleId}`,
            detalle: { items: [], total: 0 }
          };
        }
        
        // Si es un item de venta, lo agregamos
        if (log.payload?.item?.product_code) {
          ventasConsolidadas[saleId].detalle.items.push({
            product_code: log.payload.item.product_code,
            name: log.payload.item.name || 'Producto',
            qty: log.payload.item.quantity || log.payload.item.qty || 1,
            price: log.payload.item.price || 0
          });
          ventasConsolidadas[saleId].detalle.total += ((log.payload.item.price || 0) * (log.payload.item.quantity || log.payload.item.qty || 1));
        }
        return;
      }

      // Si no es venta, solo agregamos si es un comando relevante
      if (['staff.create'].includes(log.command)) {
        otrosEventos.push({
          fecha: (typeof log.created_at === 'string' ? log.created_at : new Date().toISOString()),
          comando: log.command,
          estatus: log.status,
          resumen: log.resumen || 'Acción de negocio',
          detalle: log.payload
        });
      }
    });

    return {
      success: true,
      message: 'Auditoría organizada correctamente',
      data: [...Object.values(ventasConsolidadas), ...otrosEventos]
    };
  }

  private async createEmployee(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { nombre, role, username, password, type = 'human', userId, botProfileId } = params;
    if (!nombre || !role) {
      return { success: false, message: 'Faltan datos obligatorios: nombre y role' };
    }

    // 1. Crear el usuario en la infraestructura (Auth/System)
    const userRes = await infraClient.execute('CLIENT:user-create', {
      username: username || nombre.replace(/\\s+/g, '_').toLowerCase(),
      password: password || 'DefaultPassword123!', 
      role: role.toUpperCase(),
      clienteId: context.tenantId,
      type,
      user_id: userId,
      bot_profile_id: botProfileId
    }, context.token);

    if (!userRes.success) return userRes;
    const createdUser = userRes.data?.usuario || userRes.data;

    // 2. Registrar el empleado en la configuración del Tenant (Lógica de Negocio)
    await infraClient.pushItem(context.tenantId, 'employees', {
      id: createdUser.id,
      username: createdUser.username,
      name: nombre,
      role,
      type,
      joinedAt: new Date().toISOString()
    }, context.token);

    return userRes;
  }

  private async defineTerm(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { def_type, def_key, def_label } = params;
    const typeMap: Record<string, string> = {
      'permission': 'business_definitions.permissions',
      'goal_type': 'business_definitions.goal_types',
      'task': 'business_definitions.tasks'
    };

    const path = typeMap[def_type];
    if (!path) {
      return { success: false, message: "Tipo inválido. Debe ser 'permission', 'goal_type' o 'task'." };
    }

    return infraClient.pushItem(context.tenantId, path, {
      def_key,
      def_label
    }, context.token);
  }

  private async setGoal(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { employeeId, goalType, target, startDate, endDate } = params;
    if (!employeeId || !goalType || !target) {
      return { success: false, message: 'employeeId, goalType y target son requeridos' };
    }

    // Read-Modify-Write pattern for employees array
    const res = await infraClient.readPath<any[]>(context.tenantId, 'employees', context.token);
    if (!res.success) return res;

    const employees = res.data || [];
    const empIndex = employees.findIndex(e => e.id === employeeId || e.username === employeeId);
    
    if (empIndex === -1) return { success: false, message: 'Empleado no encontrado' };

    const emp = employees[empIndex];
    if (!emp.goals) emp.goals = {};
    emp.goals[goalType] = { target, startDate, endDate };

    return infraClient.updatePath(
      context.tenantId, 
      'employees', 
      employees, 
      context.token
    );
  }

  private async listEmployees(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.execute('CLIENT:user-list', {
      clienteId: context.tenantId
    }, context.token);
  }

  private async updatePermissions(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { userId, permissions } = params;
    if (!userId || !Array.isArray(permissions)) {
      return { success: false, message: 'userId y un array de permissions son requeridos' };
    }

    return infraClient.execute('CLIENT:user-permissions-update', {
      userId,
      clienteId: context.tenantId,
      permissions
    }, context.token);
  }

  private async deleteEmployee(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { userId } = params;
    if (!userId) {
      return { success: false, message: 'userId es requerido' };
    }

    // 1. Eliminar usuario en Infraestructura (Auth/System)
    const userRes = await infraClient.execute('CLIENT:user-delete', {
      userId: userId,
      clienteId: context.tenantId
    }, context.token);

    if (!userRes.success) return userRes;

    // 2. Leer empleados actuales
    const res = await infraClient.readPath<any[]>(context.tenantId, 'employees', context.token);
    if (!res.success) return res;

    const employees = res.data || [];
    // 3. Filtrar el empleado
    const updatedEmployees = employees.filter(e => e.id !== userId);

    // 4. Guardar array completo
    return infraClient.updatePath(context.tenantId, 'employees', updatedEmployees, context.token);
  }
}

export const staffModule = new StaffModule();
