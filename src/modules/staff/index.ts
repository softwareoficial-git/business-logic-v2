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
  }

  private async createEmployee(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { name, role, type = 'human', userId, botProfileId } = params;
    if (!name || !role) {
      return { success: false, message: 'Faltan datos obligatorios: name y role' };
    }

    // 1. Crear el usuario en la infraestructura (Auth/System)
    const userRes = await infraClient.execute('CLIENT:user-create', {
      username: name.replace(/\\s+/g, '_').toLowerCase(),
      password: 'DefaultPassword123!', 
      role: role.toUpperCase(),
      clienteId: context.tenantId,
      type,
      user_id: userId,
      bot_profile_id: botProfileId
    }, context.token);

    if (!userRes.success) return userRes;
    const createdUser = userRes.data?.usuario || userRes.data;

    // 2. Registrar el empleado en la configuración del Tenant (Lógica de Negocio)
    // Esto es crucial para que comandos como 'staff.set_goal' encuentren al empleado en el array 'employees'
    await infraClient.pushItem(context.tenantId, 'employees', {
      id: createdUser.id,
      username: createdUser.username,
      name,
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
}

export const staffModule = new StaffModule();
