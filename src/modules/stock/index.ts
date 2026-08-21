import { dispatcher } from '../../core/Dispatcher';
import { DataEngine } from '../../core/DataEngine';
import { ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';

class StockModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('stock.add', {
      name: 'stock.add',
      description: 'Añade un nuevo producto al inventario',
      requiredRole: 'EMPLEADO'
    }, this.addProduct.bind(this));

    dispatcher.register('stock.list', {
      name: 'stock.list',
      description: 'Obtiene la lista completa de productos',
      requiredRole: 'EMPLEADO'
    }, this.listStock.bind(this));

    dispatcher.register('stock.update', {
      name: 'stock.update',
      description: 'Actualiza un producto existente en el inventario',
      requiredRole: 'EMPLEADO'
    }, this.updateProduct.bind(this));

    dispatcher.register('stock.update_qty', {
      name: 'stock.update_qty',
      description: 'Actualiza la cantidad de un producto específico',
      requiredRole: 'EMPLEADO'
    }, this.updateQuantity.bind(this));

    dispatcher.register('stock.delete', {
      name: 'stock.delete',
      description: 'Elimina un producto del inventario',
      requiredRole: 'DUEÑO'
    }, this.deleteProduct.bind(this));

    dispatcher.register('stock.get_reorder_needs', {
      name: 'stock.get_reorder_needs',
      description: 'Identifica productos con bajo stock y sugiere cantidades para reordenar',
      requiredRole: 'DUEÑO'
    }, this.getReorderNeeds.bind(this));

    dispatcher.register('stock.get_total_value', {
      name: 'stock.get_total_value',
      description: 'Calcula el valor monetario total de todo el inventario',
      requiredRole: 'DUEÑO'
    }, this.getTotalValue.bind(this));
  }

  private async addProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, name, price, qty, category, ...metadata } = params;
    
    if (!code || !name || price === undefined || qty === undefined || !category) {
      return { 
        success: false, 
        message: 'Faltan datos obligatorios: code, name, price, qty y category' 
      };
    }

    const engine = new DataEngine(context.tenantId, context.token);
    const stock = await engine.getNamespace('stock');
    
    stock[code] = { code, name, price, qty, category, metadata };
    
    await engine.saveNamespace('stock', stock);
    return { success: true, message: 'Producto añadido correctamente' };
  }

  private async listStock(context: RequestContext): Promise<ServiceResponse> {
    const engine = new DataEngine(context.tenantId, context.token);
    const stock = await engine.getNamespace('stock');
    return { success: true, message: 'OK', data: Object.values(stock) };
  }

  private async updateProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, ...updates } = params;
    if (!code) return { success: false, message: 'El campo "code" es obligatorio' };

    const engine = new DataEngine(context.tenantId, context.token);
    try {
        await engine.updateItem('stock', code, (item) => ({ ...item, ...updates }));
        return { success: true, message: 'Producto actualizado' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  private async updateQuantity(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, newQty } = params;
    if (!code || newQty === undefined) return { success: false, message: 'code y newQty son requeridos' };

    const engine = new DataEngine(context.tenantId, context.token);
    try {
        await engine.updateItem('stock', code, (item) => ({ ...item, qty: newQty }));
        return { success: true, message: 'Cantidad actualizada' };
    } catch (e: any) {
        return { success: false, message: e.message };
    }
  }

  private async deleteProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code } = params;
    if (!code) return { success: false, message: 'code es requerido' };

    const engine = new DataEngine(context.tenantId, context.token);
    const stock = await engine.getNamespace('stock');
    
    if (!stock[code]) return { success: false, message: 'Producto no encontrado' };

    delete stock[code];
    await engine.saveNamespace('stock', stock);
    return { success: true, message: 'Producto eliminado' };
  }

  private async getTotalValue(context: RequestContext): Promise<ServiceResponse> {
    const engine = new DataEngine(context.tenantId, context.token);
    const stock = await engine.getNamespace('stock');
    
    const total = Object.values(stock).reduce((sum: number, item: any) => {
      const price = Number(item.price);
      const qty = Number(item.qty);
      return !isNaN(price) && !isNaN(qty) ? sum + (price * qty) : sum;
    }, 0);

    return { success: true, message: 'OK', data: { totalStockValue: Number(total.toFixed(2)) } };
  }

  private async getReorderNeeds(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { threshold = 3 } = params;
    const engine = new DataEngine(context.tenantId, context.token);
    const stock = await engine.getNamespace('stock');
    
    const reorderNeeds = Object.values(stock)
      .filter((item: any) => item.qty <= threshold)
      .map((item: any) => ({
        productId: item.code,
        productName: item.name,
        currentQty: item.qty,
        minQty: threshold,
        recommendedOrderQty: (threshold * 2) - item.qty
      }));

    return { success: true, message: 'OK', data: reorderNeeds };
  }
}

export const stockModule = new StockModule();
