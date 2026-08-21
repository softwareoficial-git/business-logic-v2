"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settingsModule = void 0;
const Dispatcher_1 = require("../core/Dispatcher");
const InfraClient_1 = require("../core/InfraClient");
function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}
function deepMerge(target, source) {
    const output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = deepMerge(target[key], source[key]);
            }
            else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}
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
        const newSettings = deepMerge(currentSettings, settings);
        return await InfraClient_1.infraClient.updatePath(context.tenantId, 'settings', newSettings, context.token);
    }
}
exports.settingsModule = new SettingsModule();
