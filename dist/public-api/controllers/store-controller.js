"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicStoreController = void 0;
const product_service_1 = require("../product-service");
const tenant_service_1 = require("../tenant-service");
class PublicStoreController {
    // Nueva ruta: Resolución por nombre (slug)
    static async getProductsByName(req, res) {
        try {
            const { tenantName } = req.params;
            const tenantId = await tenant_service_1.TenantService.getTenantIdByName(tenantName);
            if (!tenantId) {
                return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
            }
            const filters = req.query;
            const products = await product_service_1.PublicProductService.getProducts(tenantId.toString(), filters);
            res.json({
                success: true,
                tenantName,
                tenantId,
                count: products.length,
                data: products
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
    // Mantenemos la ruta original por si se necesita
    static async getProducts(req, res) {
        try {
            const { tenantId } = req.params;
            const filters = req.query;
            const [products, tenantName] = await Promise.all([
                product_service_1.PublicProductService.getProducts(tenantId, filters),
                tenant_service_1.TenantService.getTenantName(tenantId)
            ]);
            res.json({
                success: true,
                tenantName,
                count: products.length,
                data: products
            });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    }
}
exports.PublicStoreController = PublicStoreController;
