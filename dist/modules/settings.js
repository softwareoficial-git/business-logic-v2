"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsModule = void 0;
const Dispatcher_1 = require("../core/Dispatcher");
const InfraClient_1 = require("../core/InfraClient");
class SettingsModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('settings.update', {
            name: 'settings.update',
            description: 'Actualiza la configuración dinámica del cliente',
            requiredRole: 'DUEÑO'
        }, this.updateSettings.bind(this));
        Dispatcher_1.dispatcher.register('settings.get', {
            name: 'settings.get',
            description: 'Obtiene la configuración dinámica del cliente',
            requiredRole: 'EMPLEADO'
        }, this.getSettings.bind(this));
    }
    async getSettings(context, params) {
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'settings', context.token);
        return {
            success: true,
            message: 'OK',
            data: res.success && res.data ? res.data : {}
        };
    }
    async updateSettings(context, params) {
        const { settings } = params;
        if (!settings || typeof settings !== 'object') {
            return { success: false, message: 'La configuración debe ser un objeto' };
        }
        // Leemos la configuración actual para hacer un merge
        const currentRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'settings', context.token);
        const currentSettings = currentRes.success && currentRes.data ? currentRes.data : {};
        const newSettings = { ...currentSettings, ...settings };
        return await InfraClient_1.infraClient.updatePath(context.tenantId, 'settings', newSettings, context.token);
    }
}
exports.settingsModule = new SettingsModule();
