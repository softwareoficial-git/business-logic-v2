import { dispatcher } from '../core/Dispatcher';
import { infraClient, ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';

class CompatibilityModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('compat.link', {
      name: 'compat.link',
      description: 'Vincula un producto con un modelo compatible',
      requiredRole: 'EMPLEADO'
    }, this.link.bind(this));

    dispatcher.register('compat.unlink', {
      name: 'compat.unlink',
      description: 'Desvincula un producto de un modelo',
      requiredRole: 'EMPLEADO'
    }, this.unlink.bind(this));

    dispatcher.register('compat.get_by_model', {
      name: 'compat.get_by_model',
      description: 'Lista productos compatibles con un modelo',
      requiredRole: 'EMPLEADO'
    }, this.getByModel.bind(this));

    dispatcher.register('compat.get_by_product', {
      name: 'compat.get_by_product',
      description: 'Lista modelos compatibles con un producto',
      requiredRole: 'EMPLEADO'
    }, this.getByProduct.bind(this));

    dispatcher.register('compat.list_models', {
      name: 'compat.list_models',
      description: 'Obtiene la lista de todos los modelos registrados',
      requiredRole: 'EMPLEADO'
    }, this.listModels.bind(this));
  }

  private async getCompatData(tenantId: number, token: string) {
    const res = await infraClient.readPath<{product_to_models: any, model_to_products: any}>(tenantId, 'compat', token);
    const data = res.success && res.data ? res.data : { product_to_models: {}, model_to_products: {} };

    // ASEGURAR ESTRUCTURA LIMPIA
    if (!data.product_to_models) data.product_to_models = {};
    if (!data.model_to_products) data.model_to_products = {};

    // COSECHA SEMÁNTICA DINÁMICA MULTIRRUBRO
    try {
      // 1. Leer configuración dinámica del inquilino para ver sus claves personalizadas de relación
      const settingsRes = await infraClient.readPath<Record<string, any>>(tenantId, 'settings', token);
      const settings = settingsRes.success && settingsRes.data ? settingsRes.data : {};
      
      // Claves de atributos que combinadas definen la relación (ej: ['Talle', 'Prenda'] para ropa)
      // Por defecto es ['Marca', 'Modelo'] para repuestos/tecnología
      const connectionKeys: string[] = settings.connection_keys || ['Marca', 'Modelo'];

      const stockRes = await infraClient.readPath<any[]>(tenantId, 'stock', token);
      if (stockRes.success && stockRes.data) {
        stockRes.data.forEach(p => {
          const metadata = p.metadata || {};
          
          // Mapear cada una de las llaves configuradas a sus valores en los metadatos del producto
          const values = connectionKeys.map(key => {
            const matchedKey = Object.keys(metadata).find(k => k.toLowerCase() === key.toLowerCase());
            return matchedKey ? String(metadata[matchedKey]).trim() : '';
          });

          // Solo creamos la relación si todos los campos requeridos para la conexión tienen valor
          if (values.every(v => v !== '')) {
            const fullEntityName = values.join(' '); // Ejemplo: "Nike" + "Remera" -> "Nike Remera"
            const productCode = p.code;

            // Generar relaciones bidireccionales en memoria en tiempo real
            if (!data.product_to_models[productCode]) data.product_to_models[productCode] = [];
            if (!data.model_to_products[fullEntityName]) data.model_to_products[fullEntityName] = [];

            if (!data.product_to_models[productCode].includes(fullEntityName)) {
              data.product_to_models[productCode].push(fullEntityName);
            }
            if (!data.model_to_products[fullEntityName].includes(productCode)) {
              data.model_to_products[fullEntityName].push(productCode);
            }
          }
        });
      }
    } catch (err) {
      console.error('[COMPAT_HARVEST_ERROR] Error al cosechar relaciones semánticas dinámicas:', err);
    }

    return data;
  }

  private async saveCompatData(tenantId: number, data: any, token: string) {
    return infraClient.updatePath(tenantId, 'compat', data, token);
  }

  private async link(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { productCode, modelName } = params;
    if (!productCode || !modelName) return { success: false, message: 'productCode y modelName son requeridos' };

    const data = await this.getCompatData(context.tenantId, context.token);

    // Actualizar bidireccional
    if (!data.product_to_models[productCode]) data.product_to_models[productCode] = [];
    if (!data.model_to_products[modelName]) data.model_to_products[modelName] = [];

    if (!data.product_to_models[productCode].includes(modelName)) {
        data.product_to_models[productCode].push(modelName);
    }
    if (!data.model_to_products[modelName].includes(productCode)) {
        data.model_to_products[modelName].push(productCode);
    }

    return this.saveCompatData(context.tenantId, data, context.token);
  }

  private async unlink(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { productCode, modelName } = params;
    const data = await this.getCompatData(context.tenantId, context.token);

    if (data.product_to_models[productCode]) {
        data.product_to_models[productCode] = data.product_to_models[productCode].filter((m: string) => m !== modelName);
    }
    if (data.model_to_products[modelName]) {
        data.model_to_products[modelName] = data.model_to_products[modelName].filter((p: string) => p !== productCode);
    }

    return this.saveCompatData(context.tenantId, data, context.token);
  }

  private async getByModel(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { modelName } = params;
    const data = await this.getCompatData(context.tenantId, context.token);
    return { success: true, message: 'OK', data: data.model_to_products[modelName] || [] };
  }

  private async getByProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { productCode } = params;
    const data = await this.getCompatData(context.tenantId, context.token);
    return { success: true, message: 'OK', data: data.product_to_models[productCode] || [] };
  }

  private async listModels(context: RequestContext, params: any): Promise<ServiceResponse> {
    const data = await this.getCompatData(context.tenantId, context.token);
    const models = Object.keys(data.model_to_products || {});
    return { success: true, message: 'OK', data: models };
  }
}

export const compatibilityModule = new CompatibilityModule();
// Trigger reload

