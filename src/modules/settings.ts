import { dispatcher } from '../core/Dispatcher';
import { infraClient, ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';

class SettingsModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('settings.update', {
      name: 'settings.update',
      description: 'Actualiza la configuración dinámica del cliente',
      requiredRole: 'DUEÑO'
    }, this.updateSettings.bind(this));

    dispatcher.register('settings.get', {
      name: 'settings.get',
      description: 'Obtiene la configuración dinámica del cliente',
      requiredRole: 'EMPLEADO'
    }, this.getSettings.bind(this));
  }

  private async getSettings(context: RequestContext, params: any): Promise<ServiceResponse> {
    const res = await infraClient.readPath<Record<string, any>>(context.tenantId, 'settings', context.token);
    return { 
        success: true, 
        message: 'OK', 
        data: res.success && res.data ? res.data : {} 
    };
  }

  private async updateSettings(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { settings } = params;
    if (!settings || typeof settings !== 'object') {
        return { success: false, message: 'La configuración debe ser un objeto' };
    }

    // Leemos la configuración actual para hacer un merge
    const currentRes = await infraClient.readPath<Record<string, any>>(context.tenantId, 'settings', context.token);
    const currentSettings = currentRes.success && currentRes.data ? currentRes.data : {};
    
    const newSettings = { ...currentSettings, ...settings };
    
    return await infraClient.updatePath(context.tenantId, 'settings', newSettings, context.token);
  }
}

export const settingsModule = new SettingsModule();
