import { dispatcher } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';

class StockModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // Añadir Producto
    dispatcher.register('stock.add', {
      name: 'stock.add',
      description: 'Añade un nuevo producto al inventario',
      requiredRole: 'EMPLEADO'
    }, this.addProduct);

    // Listar Stock
    dispatcher.register('stock.list', {
      name: 'stock.list',
      description: 'Obtiene la lista completa de productos',
      requiredRole: 'EMPLEADO'
    }, this.listStock);

    // Actualizar Cantidad
    dispatcher.register('stock.update_qty', {
      name: 'stock.update_qty',
      description: 'Actualiza la cantidad de un producto específico',
      requiredRole: 'EMPLEADO'
    }, this.updateQuantity);
  }

  private async addProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, name, price, qty } = params;
    if (!code || !name || price === undefined || qty === undefined) {
      return { success: false, message: 'Faltan datos obligatorios: code, name, price y qty' };
    }

    const item = { code, name, price, qty };
    
    // Usamos pushItem que implementa Read-Modify-Write internamente
    return infraClient.pushItem(context.tenantId, 'stock', item, context.token);
  }

  private async listStock(context: RequestContext, params: any): Promise<ServiceResponse> {
    if (context.role === 'SISTEMA_ADMIN') {
      return infraClient.readPath(context.tenantId, 'stock', context.token);
    }

    try {
      // Validamos que el usuario pertenezca al tenant solicitado
      // Obtenemos la lista de usuarios del tenant y verificamos la presencia del userId actual
      const usersRes = await infraClient.readPath<any[]>(context.tenantId, 'users', context.token);
      
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
    } catch (e: any) {
      return { success: false, message: 'Error de validación de seguridad' };
    }

    return infraClient.readPath(context.tenantId, 'stock', context.token);
  }

  // Corregido: la firma es (clienteId, path, token)
  private async listStockFixed(context: RequestContext, params: any): Promise<ServiceResponse> {
    return infraClient.readPath(context.tenantId, 'stock', context.token);
  }

  private async updateQuantity(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, newQty } = params;
    if (!code || newQty === undefined) {
      return { success: false, message: 'code y newQty son requeridos' };
    }

    // 1. Leer stock actual
    const res = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    if (!res.success) return res;

    const stock = res.data || [];
    const productIndex = stock.findIndex(p => p.code === code);

    if (productIndex === -1) {
      return { success: false, message: 'Producto no encontrado' };
    }

    // 2. Actualizar cantidad
    stock[productIndex].qty = newQty;

    // 3. Guardar array completo
    return infraClient.updatePath(context.tenantId, 'stock', stock, context.token);
  }
}

export const stockModule = new StockModule();
