import { DataEngine } from '../core/DataEngine';

/**
 * Servicio para acceso público de solo lectura.
 * Utiliza un sistema interno de privilegios para saltar la autenticación de usuario.
 */
export class PublicProductService {
  private static async getEngine() {
    // Usamos credenciales del sistema o un token de bypass para lectura pública
    const systemToken = process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN';
    return systemToken;
  }

  static async getProducts(tenantId: string, filters: Record<string, any> = {}) {
    const token = await this.getEngine();
    const engine = new DataEngine(parseInt(tenantId), token);
    
    // Obtener los datos crudos del namespace 'stock'
    const rawData = await engine.getNamespace('stock');
    
    // Convertir a lista y limpiar
    const products = Object.entries(rawData)
      .filter(([key, value]) => key !== 'meta' && !key.startsWith('ORD-') && value && typeof value === 'object')
      .map(([key, value]) => ({ ...(value as object), id: key }));

    // Filtrar basado en los parámetros
    return products.filter(product => {
      return Object.entries(filters).every(([key, value]) => {
        // Soporte para metadatos anidados: ej. "metadata.model"
        if (key.includes('.')) {
          const [base, metaKey] = key.split('.');
          return (product as any)[base]?.[metaKey] == value;
        }
        return (product as any)[key] == value;
      });
    });
  }
}
