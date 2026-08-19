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
  }

  private async getCompatData(tenantId: number, token: string) {
    const res = await infraClient.readPath<{product_to_models: any, model_to_products: any}>(tenantId, 'compat', token);
    return res.success && res.data ? res.data : { product_to_models: {}, model_to_products: {} };
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
}

export const compatibilityModule = new CompatibilityModule();
