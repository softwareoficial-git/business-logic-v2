import { Request, Response } from 'express';
import { PublicProductService } from '../product-service';
import { TenantService } from '../tenant-service';

export class PublicStoreController {
  static async getProducts(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      
      // Extraer filtros de la query string
      const filters = req.query;
      
      const [products, tenantName] = await Promise.all([
        PublicProductService.getProducts(tenantId, filters),
        TenantService.getTenantName(tenantId)
      ]);
      
      res.json({
        success: true,
        tenantName,
        count: products.length,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}
