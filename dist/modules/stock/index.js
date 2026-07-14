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
        // Actualizar Cantidad
        Dispatcher_1.dispatcher.register('stock.update_qty', {
            name: 'stock.update_qty',
            description: 'Actualiza la cantidad de un producto específico',
            requiredRole: 'EMPLEADO'
        }, this.updateQuantity);
    }
    async addProduct(context, params) {
        const { code, name, price, qty } = params;
        if (!code || !name || price === undefined || qty === undefined) {
            return { success: false, message: 'Faltan datos obligatorios: code, name, price y qty' };
        }
        const item = { code, name, price, qty };
        // Usamos pushItem que implementa Read-Modify-Write internamente
        return InfraClient_1.infraClient.pushItem(context.tenantId, 'stock', item, context.token);
    }
    async listStock(context, params) {
        if (context.role === 'SISTEMA_ADMIN') {
            return InfraClient_1.infraClient.readPath(context.tenantId, 'stock', context.token);
        }
        try {
            // Validamos que el usuario pertenezca al tenant solicitado
            // Obtenemos la lista de usuarios del tenant y verificamos la presencia del userId actual
            const usersRes = await InfraClient_1.infraClient.readPath(context.tenantId, 'users', context.token);
            if (!usersRes.success || !usersRes.data) {
                return { success: false, message: 'Error al validar pertenencia al tenant' };
            }
            const users = usersRes.data;
            const userExists = Array.isArray(users)
                ? users.some(u => u.id === context.userId || u.username === context.userId)
                : false;
            if (!userExists) {
                return { success: false, message: 'Acceso no autorizado: el usuario no pertenece a este tenant' };
            }
        }
        catch (e) {
            return { success: false, message: 'Error de validación de seguridad' };
        }
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
}
exports.stockModule = new StockModule();
