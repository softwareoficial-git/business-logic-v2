import { dispatcher } from '../core/Dispatcher';
import { infraClient, ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';
import { TenantService } from '../public-api/tenant-service';

function isObject(item: any): boolean {
  return (item && typeof item === 'object' && !Array.isArray(item));
}

function deepMerge(target: any, source: any): any {
  const output = Object.assign({}, target);
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) Object.assign(output, { [key]: source[key] });
        else output[key] = deepMerge(target[key], source[key]);
      } else {
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
    const [res, tenantName] = await Promise.all([
        infraClient.readPath<Record<string, any>>(context.tenantId, 'settings', context.token),
        TenantService.getTenantName(context.tenantId.toString())
    ]);
    
    const settings = res.success && res.data ? res.data : {};
    return { 
        success: true, 
        message: 'OK', 
        data: { ...settings, tenantName }
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
    
    const newSettings = deepMerge(currentSettings, settings);
    
    return await infraClient.updatePath(context.tenantId, 'settings', newSettings, context.token);
  }
}

export const settingsModule = new SettingsModule();
