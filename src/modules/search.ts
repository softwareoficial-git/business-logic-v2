import { dispatcher } from '../core/Dispatcher';
import { infraClient, ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';

class SearchModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('search.suggest', {
      name: 'search.suggest',
      description: 'Ofrece sugerencias predictivas para la búsqueda',
      requiredRole: 'PARTNER'
    }, this.suggest.bind(this));
  }

  private async getAllData(tenantId: number, token: string) {
    const stockRes = await infraClient.readPath<any[]>(tenantId, 'stock', token);
    const compatRes = await infraClient.readPath<{product_to_models: any, model_to_products: any}>(tenantId, 'compat', token);
    
    return {
        stock: stockRes.success && stockRes.data ? stockRes.data : [],
        compat: compatRes.success && compatRes.data ? compatRes.data : { product_to_models: {}, model_to_products: {} }
    };
  }

  private async suggest(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { query = '', currentState = 'BRAND_SELECTION', contextData = {} } = params;
    const { stock, compat } = await this.getAllData(context.tenantId, context.token);
    const q = query.toLowerCase();

    // Lógica basada en el estado actual y la entrada del usuario
    let nextState = currentState;
    let options: string[] = [];
    let nextContext = { ...contextData };

    switch (currentState) {
      case 'BRAND_SELECTION':
        options = this.getUniqueBrands(compat);
        if (q && options.some(b => b.toLowerCase().includes(q))) {
            nextContext.brand = options.find(b => b.toLowerCase().includes(q))!;
            nextState = 'MODEL_SELECTION';
            options = Object.keys(compat.model_to_products).filter(m => m.startsWith(nextContext.brand));
        }
        break;

      case 'MODEL_SELECTION':
        options = Object.keys(compat.model_to_products).filter(m => m.startsWith(nextContext.brand || ''));
        if (q && options.some(m => m.toLowerCase().includes(q))) {
            nextContext.model = options.find(m => m.toLowerCase().includes(q))!;
            nextState = 'CATEGORY_SELECTION';
            const productCodes = compat.model_to_products[nextContext.model];
            const products = stock.filter(p => productCodes.includes(p.code));
            options = [...new Set(products.map(p => p.category))];
        }
        break;
      
      case 'CATEGORY_SELECTION':
        const productCodes = compat.model_to_products[nextContext.model];
        const products = stock.filter(p => productCodes.includes(p.code));
        options = [...new Set(products.map(p => p.category))];
        if (q && options.some(c => c.toLowerCase().includes(q))) {
            nextContext.category = options.find(c => c.toLowerCase().includes(q))!;
            nextState = 'PRODUCT_SELECTION';
            options = products.filter(p => p.category === nextContext.category).map(p => p.name);
        }
        break;
    }

    return { 
      success: true, 
      message: 'OK', 
      data: { 
        state: nextState, 
        options: options,
        context: nextContext
      } 
    };
  }

  private getUniqueBrands(compat: any) {
    // Asumimos que los modelos vienen como "Marca Modelo"
    const allModels = Object.keys(compat.model_to_products);
    const brands = new Set(allModels.map(m => m.split(' ')[0]));
    return Array.from(brands);
  }
}

export const searchModule = new SearchModule();
