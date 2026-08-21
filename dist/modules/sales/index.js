"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.salesModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const DataEngine_1 = require("../../core/DataEngine");
class SalesModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('sales.checkout', {
            name: 'sales.checkout',
            description: 'Procesa una venta: valida stock, descuenta y registra venta',
            requiredRole: 'EMPLEADO'
        }, this.checkout.bind(this));
        Dispatcher_1.dispatcher.register('sales.history', {
            name: 'sales.history',
            description: 'Obtiene el historial de ventas de la empresa',
            requiredRole: 'DUEÑO'
        }, this.getHistory.bind(this));
    }
    async checkout(context, params) {
        const { items, customerId, clientTimestamp, client_request_id, ticket } = params;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return { success: false, message: 'La lista de items es requerida' };
        }
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const stock = await engine.getNamespace('stock');
        const productos = await engine.getNamespace('productos');
        const soldItems = [];
        let totalSale = 0;
        // 1. Validar Stock y calcular total (simulación de transacción)
        for (const item of items) {
            const product = stock[item.code];
            const productMeta = productos[item.code];
            if (!product)
                return { success: false, message: `Producto ${item.code} no encontrado` };
            if (product.qty < item.qty)
                return { success: false, message: `Stock insuficiente para ${productMeta?.name || item.code}` };
            let lineTotal = product.price * item.qty;
            soldItems.push({ product_code: item.code, name: productMeta?.name, qty: item.qty, price: product.price, subtotal: lineTotal });
            totalSale += lineTotal;
        }
        // 2. Ejecutar actualizaciones atómicas usando DataEngine
        for (const item of items) {
            await engine.updateItem('stock', item.code, (p) => ({ ...p, qty: p.qty - item.qty }));
        }
        // 3. Registrar venta
        const sales = await engine.getNamespace('sales');
        const saleId = `ORD-${Date.now()}`;
        sales[saleId] = {
            id: saleId,
            total: totalSale,
            items: soldItems,
            customerId,
            empleado: context.userId,
            createdAt: clientTimestamp || new Date().toISOString()
        };
        await engine.saveNamespace('sales', sales);
        return { success: true, message: 'Venta procesada.', data: { sale_id: saleId, total: totalSale } };
    }
    async getHistory(context) {
        const engine = new DataEngine_1.DataEngine(context.tenantId, context.token);
        const sales = await engine.getNamespace('sales');
        let salesArray = [];
        if (Array.isArray(sales)) {
            // Legacy format
            salesArray = sales;
        }
        else if (typeof sales === 'object' && sales !== null) {
            // New DataEngine object format
            salesArray = Object.values(sales);
        }
        // Sanitization: Ensure only valid objects with an 'id' are returned
        const cleanSales = salesArray.filter((s) => s && typeof s === 'object' && s.id);
        return { success: true, message: 'OK', data: cleanSales };
    }
}
exports.salesModule = new SalesModule();
