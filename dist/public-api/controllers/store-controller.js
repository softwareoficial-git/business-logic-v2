"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicStoreController = void 0;
const product_service_1 = require("../product-service");
const tenant_service_1 = require("../tenant-service");
class PublicStoreController {
    static async getProducts(req, res) {
        try {
            const { tenantId } = req.params;
            // Extraer filtros de la query string
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
