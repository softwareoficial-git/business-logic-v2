"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.operationsModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class OperationsModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Asignar Tarea
        Dispatcher_1.dispatcher.register('staff.assign_task', {
            name: 'staff.assign_task',
            description: 'Asigna una tarea definida al personal',
            requiredRole: 'DUEÑO',
            requiredPlan: 'free'
        }, this.assignTask);
        // Completar Tarea
        Dispatcher_1.dispatcher.register('staff.complete_task', {
            name: 'staff.complete_task',
            description: 'Marca una tarea como completada',
            requiredRole: 'EMPLEADO',
            requiredPlan: 'free'
        }, this.completeTask);
        // Listar Tareas Pendientes
        Dispatcher_1.dispatcher.register('staff.get_pending_tasks', {
            name: 'staff.get_pending_tasks',
            description: 'Obtiene las tareas pendientes para el usuario actual',
            requiredRole: 'EMPLEADO',
            requiredPlan: 'free'
        }, this.getPendingTasks);
    }
    async assignTask(context, params) {
        try {
            const { employeeId, taskKey, deadline } = params;
            if (!employeeId || !taskKey) {
                return { success: false, message: 'employeeId y taskKey son requeridos' };
            }
            const task = {
                id: `TASK-${Date.now()}`,
                employeeId,
                taskKey,
                status: 'pending',
                assignedAt: new Date().toISOString(),
                deadline,
                tenantId: context.tenantId
            };
            return InfraClient_1.infraClient.pushItem(context.tenantId, 'tasks', task, context.token);
        }
        catch (e) {
            return { success: false, message: e.message || 'Error asignando tarea' };
        }
    }
    async completeTask(context, params) {
        try {
            const { taskId } = params;
            if (!taskId)
                return { success: false, message: 'taskId es requerido' };
            // Buscamos la tarea para obtener su índice
            const tasksRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'tasks', context.token);
            if (!tasksRes.success)
                return tasksRes;
            const tasks = tasksRes.data || [];
            const index = tasks.findIndex(t => t.id === taskId);
            if (index === -1)
                return { success: false, message: 'Tarea no encontrada' };
            // Actualización quirúrgica del estado
            return InfraClient_1.infraClient.updatePath(context.tenantId, `tasks[${index}].status`, 'completed', context.token);
        }
        catch (e) {
            return { success: false, message: e.message || 'Error completando tarea' };
        }
    }
    async getPendingTasks(context, params) {
        try {
            const tasks = await InfraClient_1.infraClient.queryJson(context.tenantId, 'tasks', {
                employeeId: context.userId,
                status: 'pending'
            }, context.token);
            return {
                success: true,
                message: 'Tareas obtenidas',
                data: tasks.data || []
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Error obteniendo tareas' };
        }
    }
}
exports.operationsModule = new OperationsModule();
