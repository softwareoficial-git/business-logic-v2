import { Request, Response } from 'express';
import { PublicProductService } from '../product-service';
import { TenantService } from '../tenant-service';

export class PublicStoreController {
  // Nueva ruta: Resolución por nombre (slug)
  static async getProductsByName(req: Request, res: Response) {
    try {
      const { tenantName } = req.params;
      
      const tenantId = await TenantService.getTenantIdByName(tenantName);
      if (!tenantId) {
        return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
      }
      
      const filters = req.query;
      
      const products = await PublicProductService.getProducts(tenantId.toString(), filters);
      
      res.json({
        success: true,
        tenantName,
        tenantId,
        count: products.length,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // Mantenemos la ruta original por si se necesita
  static async getProducts(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
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
