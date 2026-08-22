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

  static async getProducts(tenantId: string, filters: Record<string, any | any[]> = {}) {
    const token = await this.getEngine();
    const engine = new DataEngine(parseInt(tenantId), token);
    
    const rawData = await engine.getNamespace('stock');
    
    const products = Object.entries(rawData)
      .filter(([key, value]) => key !== 'meta' && !key.startsWith('ORD-') && value && typeof value === 'object')
      .map(([key, value]) => {
        const product = value as any;
        return {
          ...product,
          id: key,
          image_url: product.metadata?.image_url || null
        };
      });

    return products.filter(product => {
      return Object.entries(filters).every(([key, filterValue]) => {
        const values = Array.isArray(filterValue) ? filterValue : [filterValue];

        if (key === 'category') {
          // Si hay múltiples categorías, el producto debe cumplir al menos una (o ser jerárquica)
          return values.some(val => (product.category === val) || (product.category?.startsWith(`${val}/`)));
        }

        if (key.startsWith('metadata.')) {
          const metaKey = key.split('.')[1];
          // Para metadatos, si hay múltiples valores para la misma llave, se comporta como OR
          // pero entre diferentes llaves de metadatos se comporta como AND (gracias al .every de arriba)
          return values.includes(product.metadata?.[metaKey]);
        }

        return values.includes((product as any)[key]);
      });
    });
  }
}
