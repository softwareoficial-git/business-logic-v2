"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicProductService = void 0;
const DataEngine_1 = require("../core/DataEngine");
/**
 * Servicio para acceso público de solo lectura.
 * Utiliza un sistema interno de privilegios para saltar la autenticación de usuario.
 */
class PublicProductService {
    static async getEngine() {
        // Usamos credenciales del sistema o un token de bypass para lectura pública
        const systemToken = process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN';
        return systemToken;
    }
    static async getProducts(tenantId, filters = {}) {
        const token = await this.getEngine();
        const engine = new DataEngine_1.DataEngine(parseInt(tenantId), token);
        // Obtener los datos crudos del namespace 'stock'
        const rawData = await engine.getNamespace('stock');
        // Convertir a lista y limpiar
        const products = Object.entries(rawData)
            .filter(([key, value]) => key !== 'meta' && !key.startsWith('ORD-') && value && typeof value === 'object')
            .map(([key, value]) => {
            const product = value;
            return {
                ...product,
                id: key,
                image_url: product.metadata?.image_url || null // Promocionar image_url a la raíz
            };
        });
        // Filtrar basado en los parámetros
        return products.filter(product => {
            return Object.entries(filters).every(([key, value]) => {
                // Soporte para metadatos anidados: ej. "metadata.model"
                if (key.includes('.')) {
                    const [base, metaKey] = key.split('.');
                    return product[base]?.[metaKey] == value;
                }
                return product[key] == value;
            });
        });
    }
}
exports.PublicProductService = PublicProductService;
