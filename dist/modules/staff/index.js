"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class StaffModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Crear Empleado
        Dispatcher_1.dispatcher.register('staff.create', {
            name: 'staff.create',
            description: 'Crea un nuevo empleado (Humano o Bot) vinculado a la empresa',
            requiredRole: 'DUEÑO'
        }, this.createEmployee);
        // Listar Empleados
        Dispatcher_1.dispatcher.register('staff.list', {
            name: 'staff.list',
            description: 'Lista todos los empleados de la empresa',
            requiredRole: 'DUEÑO'
        }, this.listEmployees);
        // Definir Término de Negocio (Permiso, Meta, Tarea)
        Dispatcher_1.dispatcher.register('staff.define_term', {
            name: 'staff.define_term',
            description: 'Define un término personalizado (tipo: permission, goal_type, task)',
            requiredRole: 'DUEÑO'
        }, this.defineTerm);
        // Asignar Meta de Rendimiento
        Dispatcher_1.dispatcher.register('staff.set_goal', {
            name: 'staff.set_goal',
            description: 'Asigna una meta de rendimiento a un empleado',
            requiredRole: 'DUEÑO'
        }, this.setGoal);
        // Actualizar Permisos
        Dispatcher_1.dispatcher.register('staff.update_permissions', {
            name: 'staff.update_permissions',
            description: 'Actualiza los permisos granulares de un empleado',
            requiredRole: 'DUEÑO'
        }, this.updatePermissions);
    }
    async createEmployee(context, params) {
        const { name, role, type = 'human', userId, botProfileId } = params;
        if (!name || !role) {
            return { success: false, message: 'Faltan datos obligatorios: name y role' };
        }
        // 1. Crear el usuario en la infraestructura (Auth/System)
        const userRes = await InfraClient_1.infraClient.execute('CLIENT:user-create', {
            username: name.replace(/\\s+/g, '_').toLowerCase(),
            password: 'DefaultPassword123!',
            role: role.toUpperCase(),
            clienteId: context.tenantId,
            type,
            user_id: userId,
            bot_profile_id: botProfileId
        }, context.token);
        if (!userRes.success)
            return userRes;
        const createdUser = userRes.data?.usuario || userRes.data;
        // 2. Registrar el empleado en la configuración del Tenant (Lógica de Negocio)
        // Esto es crucial para que comandos como 'staff.set_goal' encuentren al empleado en el array 'employees'
        await InfraClient_1.infraClient.pushItem(context.tenantId, 'employees', {
            id: createdUser.id,
            username: createdUser.username,
            name,
            role,
            type,
            joinedAt: new Date().toISOString()
        }, context.token);
        return userRes;
    }
    async defineTerm(context, params) {
        const { def_type, def_key, def_label } = params;
        const typeMap = {
            'permission': 'business_definitions.permissions',
            'goal_type': 'business_definitions.goal_types',
            'task': 'business_definitions.tasks'
        };
        const path = typeMap[def_type];
        if (!path) {
            return { success: false, message: "Tipo inválido. Debe ser 'permission', 'goal_type' o 'task'." };
        }
        return InfraClient_1.infraClient.pushItem(context.tenantId, path, {
            def_key,
            def_label
        }, context.token);
    }
    async setGoal(context, params) {
        const { employeeId, goalType, target, startDate, endDate } = params;
        if (!employeeId || !goalType || !target) {
            return { success: false, message: 'employeeId, goalType y target son requeridos' };
        }
        // Read-Modify-Write pattern for employees array
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'employees', context.token);
        if (!res.success)
            return res;
        const employees = res.data || [];
        const empIndex = employees.findIndex(e => e.id === employeeId || e.username === employeeId);
        if (empIndex === -1)
            return { success: false, message: 'Empleado no encontrado' };
        const emp = employees[empIndex];
        if (!emp.goals)
            emp.goals = {};
        emp.goals[goalType] = { target, startDate, endDate };
        return InfraClient_1.infraClient.updatePath(context.tenantId, 'employees', employees, context.token);
    }
    async listEmployees(context, params) {
        return InfraClient_1.infraClient.execute('CLIENT:user-list', {
            clienteId: context.tenantId
        }, context.token);
    }
    async updatePermissions(context, params) {
        const { userId, permissions } = params;
        if (!userId || !Array.isArray(permissions)) {
            return { success: false, message: 'userId y un array de permissions son requeridos' };
        }
        return InfraClient_1.infraClient.execute('CLIENT:user-permissions-update', {
            userId,
            clienteId: context.tenantId,
            permissions
        }, context.token);
    }
}
exports.staffModule = new StaffModule();
