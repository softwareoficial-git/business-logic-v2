"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stockModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class StockModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        // Añadir Producto
        Dispatcher_1.dispatcher.register('stock.add', {
            name: 'stock.add',
            description: 'Añade un nuevo producto al inventario',
            requiredRole: 'EMPLEADO'
        }, this.addProduct);
        // Listar Stock
        Dispatcher_1.dispatcher.register('stock.list', {
            name: 'stock.list',
            description: 'Obtiene la lista completa de productos',
            requiredRole: 'EMPLEADO'
        }, this.listStock);
        // Actualizar Producto
        Dispatcher_1.dispatcher.register('stock.update', {
            name: 'stock.update',
            description: 'Actualiza un producto existente en el inventario',
            requiredRole: 'EMPLEADO'
        }, this.updateProduct);
        // Actualizar Cantidad
        Dispatcher_1.dispatcher.register('stock.update_qty', {
            name: 'stock.update_qty',
            description: 'Actualiza la cantidad de un producto específico',
            requiredRole: 'EMPLEADO'
        }, this.updateQuantity);
        // Eliminar Producto
        Dispatcher_1.dispatcher.register('stock.delete', {
            name: 'stock.delete',
            description: 'Elimina un producto del inventario',
            requiredRole: 'DUEÑO'
        }, this.deleteProduct);
        // Obtener Necesidades de Reorden (Bajo Stock)
        Dispatcher_1.dispatcher.register('stock.get_reorder_needs', {
            name: 'stock.get_reorder_needs',
            description: 'Identifica productos con bajo stock y sugiere cantidades para reordenar',
            requiredRole: 'DUEÑO' // Solo el DUEÑO debería ver esto
        }, this.getReorderNeeds);
        // Obtener Valor Total del Stock
        Dispatcher_1.dispatcher.register('stock.get_total_value', {
            name: 'stock.get_total_value',
            description: 'Calcula el valor monetario total de todo el inventario',
            requiredRole: 'DUEÑO' // Solo el DUEÑO debería ver esto
        }, this.getTotalValue);
    }
    async addProduct(context, params) {
        const { code, name, price, qty, category, ...metadata } = params;
        // Validación de campos obligatorios globales
        if (!code || !name || price === undefined || qty === undefined || !category) {
            return {
                success: false,
                message: 'Faltan datos obligatorios globales: code, name, price, qty y category'
            };
        }
        // Estructura universal: campos base + metadata dinámica
        const item = {
            code,
            name,
            price,
            qty,
            category,
            metadata: Object.keys(metadata).length > 0 ? metadata : {}
        };
        // Usamos pushItem que implementa Read-Modify-Write internamente
        return InfraClient_1.infraClient.pushItem(context.tenantId, 'stock', item, context.token);
    }
    async updateProduct(context, params) {
        const { code, ...updates } = params;
        if (!code) {
            return { success: false, message: 'El campo "code" es obligatorio para actualizar' };
        }
        // 1. Leer stock actual
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        if (!res.success)
            return res;
        const stock = res.data || [];
        const productIndex = stock.findIndex(p => p.code === code);
        if (productIndex === -1) {
            return { success: false, message: `Producto con code ${code} no encontrado` };
        }
        // 2. Aplicar actualizaciones manteniendo los campos existentes
        stock[productIndex] = { ...stock[productIndex], ...updates };
        // 3. Guardar array completo
        return InfraClient_1.infraClient.updatePath(context.tenantId, 'stock', stock, context.token);
    }
    async listStock(context, params) {
        return InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
    }
    // Corregido: la firma es (clienteId, path, token)
    async listStockFixed(context, params) {
        return InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
    }
    async updateQuantity(context, params) {
        const { code, newQty } = params;
        if (!code || newQty === undefined) {
            return { success: false, message: 'code y newQty son requeridos' };
        }
        // 1. Leer stock actual
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        if (!res.success)
            return res;
        const stock = res.data || [];
        const productIndex = stock.findIndex(p => p.code === code);
        if (productIndex === -1) {
            return { success: false, message: 'Producto no encontrado' };
        }
        // 2. Actualizar cantidad
        stock[productIndex].qty = newQty;
        // 3. Guardar array completo
        return InfraClient_1.infraClient.updatePath(context.tenantId, 'stock', stock, context.token);
    }
    async deleteProduct(context, params) {
        const { code } = params;
        if (!code) {
            return { success: false, message: 'code es requerido' };
        }
        // 1. Leer stock actual
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        if (!res.success)
            return res;
        const stock = res.data || [];
        const initialLength = stock.length;
        // 2. Filtrar el producto
        const updatedStock = stock.filter(p => p.code !== code);
        if (updatedStock.length === initialLength) {
            return { success: false, message: 'Producto no encontrado' };
        }
        // 3. Guardar array completo filtrado
        return InfraClient_1.infraClient.updatePath(context.tenantId, 'stock', updatedStock, context.token);
    }
    async getTotalValue(context, params) {
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        if (!res.success)
            return res;
        const stock = res.data || [];
        const totalStockValue = stock.reduce((sum, item) => {
            // Asegurarse de que price y qty sean números válidos
            const price = Number(item.price);
            const qty = Number(item.qty);
            if (!isNaN(price) && !isNaN(qty)) {
                return sum + (price * qty);
            }
            return sum; // Ignorar items con valores no numéricos
        }, 0);
        return {
            success: true,
            message: 'Valor total de stock calculado',
            data: { totalStockValue: Number(totalStockValue.toFixed(2)) }
        };
    }
    async getReorderNeeds(context, params) {
        const { threshold = 3 } = params; // Umbral por defecto de 3 ítems
        const res = await InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        if (!res.success)
            return res;
        const stock = res.data || [];
        const reorderNeeds = stock.filter(item => item.qty <= threshold).map(item => ({
            productId: item.id || item.code, // Usar id o code como identificador
            productName: item.name,
            currentQty: item.qty,
            minQty: threshold, // Mostrar el umbral aplicado
            recommendedOrderQty: (threshold * 2) - item.qty // Sugerir el doble del umbral menos la cantidad actual
        }));
        return {
            success: true,
            message: 'Necesidades de reorden obtenidas',
            data: reorderNeeds
        };
    }
}
exports.stockModule = new StockModule();
