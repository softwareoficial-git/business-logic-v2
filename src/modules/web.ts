import { dispatcher } from '../core/Dispatcher';
import { DataEngine } from '../core/DataEngine';
import { ServiceResponse } from '../core/InfraClient';
import { RequestContext } from '../core/RequestContext';

class WebModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    dispatcher.register('web.search', {
      name: 'web.search',
      description: 'Búsqueda predictiva y relacional para tiendas web/WhatsApp',
      requiredRole: 'EMPLEADO' // Ajustar según permisos públicos
    }, this.search.bind(this));
  }

  private async search(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { query = '' } = params;
    const q = query.toLowerCase();
    if (q.length < 2) return { success: true, message: 'OK', data: [] };

    const engine = new DataEngine(context.tenantId, context.token);
    const [catalog, productos] = await Promise.all([
      engine.getNamespace('dynamic_catalog'),
      engine.getNamespace('productos')
    ]);

    const results: any[] = [];

    // 1. Sugerencias de Valores Dinámicos (Marcas, Modelos, Categorías)
    Object.entries(catalog.values || {}).forEach(([id, val]: any) => {
      if (val.value.toLowerCase().includes(q)) {
        results.push({
          type: 'suggestion',
          label: val.value,
          ref_id: id,
          field: catalog.fields[val.field_id]?.label
        });
      }
    });

    // 2. Sugerencias de Productos (con unión relacional)
    Object.entries(productos).forEach(([code, p]: any) => {
      if (p.name.toLowerCase().includes(q)) {
        results.push({
          type: 'product',
          label: p.name,
          ref_id: code,
          price: p.price
        });
      }
    });

    return { success: true, message: 'OK', data: results.slice(0, 10) };
  }
}

export const webModule = new WebModule();
