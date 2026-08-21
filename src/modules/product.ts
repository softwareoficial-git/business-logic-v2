import { dispatcher } from '../core/Dispatcher';
import { DataEngine } from '../core/DataEngine';
import { ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';

class ProductModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('product.get', {
      name: 'product.get',
      description: 'Obtiene la información completa de un producto unificada (datos + stock + compat)',
      requiredRole: 'EMPLEADO'
    }, this.getProduct.bind(this));

    dispatcher.register('product.search', {
      name: 'product.search',
      description: 'Búsqueda avanzada por marca, calidad, marco o nombre',
      requiredRole: 'EMPLEADO'
    }, this.searchProducts.bind(this));

    dispatcher.register('product.add', {
      name: 'product.add',
      description: 'Crea un nuevo producto en el catálogo dinámico',
      requiredRole: 'EMPLEADO'
    }, this.addProduct.bind(this));
  }

  private async addProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { code, name, category_id, model_ids, metadata } = params;
    const engine = new DataEngine(context.tenantId, context.token);
    
    const productos = await engine.getNamespace('productos');
    productos[code] = { code, name, category_id, model_ids, metadata };
    
    await engine.saveNamespace('productos', productos);
    return { success: true, message: 'Producto creado exitosamente' };
  }

  private async getProduct(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { productCode } = params;
    if (!productCode) return { success: false, message: 'productCode es requerido' };

    const engine = new DataEngine(context.tenantId, context.token);
    const product = await engine.getProductFullData(productCode);

    if (!product) {
      return { success: false, message: 'Producto no encontrado' };
    }

    return { success: true, message: 'OK', data: product };
  }

  private async searchProducts(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { query = '' } = params;
    const engine = new DataEngine(context.tenantId, context.token);
    const productos = await engine.getNamespace('productos');
    
    const results = Object.values(productos).filter((p: any) => {
      const searchString = `${p.name || ''} ${p.metadata?.marca || ''} ${p.metadata?.calidad || ''} ${p.metadata?.marco || ''}`.toLowerCase();
      return query.toLowerCase().split(' ').every((q: string) => searchString.includes(q));
    });

    return { success: true, message: 'OK', data: results };
  }
}

export const productModule = new ProductModule();
