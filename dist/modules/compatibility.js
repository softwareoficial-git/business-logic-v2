"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compatibilityModule = void 0;
const Dispatcher_1 = require("../core/Dispatcher");
const InfraClient_1 = require("../core/InfraClient");
class CompatibilityModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('compat.link', {
            name: 'compat.link',
            description: 'Vincula un producto con un modelo compatible',
            requiredRole: 'EMPLEADO'
        }, this.link);
        Dispatcher_1.dispatcher.register('compat.unlink', {
            name: 'compat.unlink',
            description: 'Desvincula un producto de un modelo',
            requiredRole: 'EMPLEADO'
        }, this.unlink);
        Dispatcher_1.dispatcher.register('compat.get_by_model', {
            name: 'compat.get_by_model',
            description: 'Lista productos compatibles con un modelo',
            requiredRole: 'EMPLEADO'
        }, this.getByModel);
        Dispatcher_1.dispatcher.register('compat.get_by_product', {
            name: 'compat.get_by_product',
            description: 'Lista modelos compatibles con un producto',
            requiredRole: 'EMPLEADO'
        }, this.getByProduct);
    }
    async getCompatData(tenantId, token) {
        const res = await InfraClient_1.infraClient.readPath(tenantId, 'compat', token);
        return res.success && res.data ? res.data : { product_to_models: {}, model_to_products: {} };
    }
    async saveCompatData(tenantId, data, token) {
        return InfraClient_1.infraClient.updatePath(tenantId, 'compat', data, token);
    }
    async link(context, params) {
        const { productCode, modelName } = params;
        if (!productCode || !modelName)
            return { success: false, message: 'productCode y modelName son requeridos' };
        const data = await this.getCompatData(context.tenantId, context.token);
        // Actualizar bidireccional
        if (!data.product_to_models[productCode])
            data.product_to_models[productCode] = [];
        if (!data.model_to_products[modelName])
            data.model_to_products[modelName] = [];
        if (!data.product_to_models[productCode].includes(modelName)) {
            data.product_to_models[productCode].push(modelName);
        }
        if (!data.model_to_products[modelName].includes(productCode)) {
            data.model_to_products[modelName].push(productCode);
        }
        return this.saveCompatData(context.tenantId, data, context.token);
    }
    async unlink(context, params) {
        const { productCode, modelName } = params;
        const data = await this.getCompatData(context.tenantId, context.token);
        if (data.product_to_models[productCode]) {
            data.product_to_models[productCode] = data.product_to_models[productCode].filter((m) => m !== modelName);
        }
        if (data.model_to_products[modelName]) {
            data.model_to_products[modelName] = data.model_to_products[modelName].filter((p) => p !== productCode);
        }
        return this.saveCompatData(context.tenantId, data, context.token);
    }
    async getByModel(context, params) {
        const { modelName } = params;
        const data = await this.getCompatData(context.tenantId, context.token);
        return { success: true, message: 'OK', data: data.model_to_products[modelName] || [] };
    }
    async getByProduct(context, params) {
        const { productCode } = params;
        const data = await this.getCompatData(context.tenantId, context.token);
        return { success: true, message: 'OK', data: data.product_to_models[productCode] || [] };
    }
}
exports.compatibilityModule = new CompatibilityModule();
