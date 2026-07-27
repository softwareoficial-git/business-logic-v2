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

    // Actualizar Producto
    dispatcher.register('stock.update', {
      name: 'stock.update',
      description: 'Actualiza un producto existente en el inventario',
      requiredRole: 'EMPLEADO'
    }, this.updateProduct);

    // Actualizar Cantidad
    dispatcher.register('stock.update_qty', {
      name: 'stock.update_qty',
      description: 'Actualiza la cantidad de un producto específico',
      requiredRole: 'EMPLEADO'
    }, this.updateQuantity);

    // Eliminar Producto
    dispatcher.register('stock.delete', {
      name: 'stock.delete',
      description: 'Elimina un producto del inventario',
      requiredRole: 'DUEÑO'
    }, this.deleteProduct);

    // Obtener Necesidades de Reorden (Bajo Stock)
    dispatcher.register('stock.get_reorder_needs', {
      name: 'stock.get_reorder_needs',
      description: 'Identifica productos con bajo stock y sugiere cantidades para reordenar',
      requiredRole: 'DUEÑO' // Solo el DUEÑO debería ver esto
    }, this.getReorderNeeds);

    // Obtener Valor Total del Stock
    dispatcher.register('stock.get_total_value', {
      name: 'stock.get_total_value',
      description: 'Calcula el valor monetario total de todo el inventario',
      requiredRole: 'DUEÑO' // Solo el DUEÑO debería ver esto
    }, this.getTotalValue);
  }

  private async addProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
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
    return infraClient.pushItem(context.tenantId, 'stock', item, context.token);
  }

  private async updateProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, ...updates } = params;
    
    if (!code) {
      return { success: false, message: 'El campo "code" es obligatorio para actualizar' };
    }

    // 1. Leer stock actual
    const res = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    if (!res.success) return res;

    const stock = res.data || [];
    const productIndex = stock.findIndex(p => p.code === code);

    if (productIndex === -1) {
      return { success: false, message: `Producto con code ${code} no encontrado` };
    }

    // 2. Aplicar actualizaciones manteniendo los campos existentes
    stock[productIndex] = { ...stock[productIndex], ...updates };

    // 3. Guardar array completo
    return infraClient.updatePath(context.tenantId, 'stock', stock, context.token);
  }

  private async listStock(context: RequestContext, params: any): Promise<ServiceResponse> {
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

  private async deleteProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code } = params;
    if (!code) {
      return { success: false, message: 'code es requerido' };
    }

    // 1. Leer stock actual
    const res = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    if (!res.success) return res;

    const stock = res.data || [];
    const initialLength = stock.length;
    
    // 2. Filtrar el producto
    const updatedStock = stock.filter(p => p.code !== code);

    if (updatedStock.length === initialLength) {
      return { success: false, message: 'Producto no encontrado' };
    }

    // 3. Guardar array completo filtrado
    return infraClient.updatePath(context.tenantId, 'stock', updatedStock, context.token);
  }

  private async getTotalValue(context: RequestContext, params: any): Promise<ServiceResponse> {
    const res = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    if (!res.success) return res;

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

  private async getReorderNeeds(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { threshold = 3 } = params; // Umbral por defecto de 3 ítems

    const res = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    if (!res.success) return res;

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

export const stockModule = new StockModule();
