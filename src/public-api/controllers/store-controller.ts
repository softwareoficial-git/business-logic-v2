import { Request, Response } from 'express';
import { PublicProductService } from '../product-service';
import { TenantService } from '../tenant-service';
import { DataEngine } from '../../core/DataEngine';

export class PublicStoreController {
  
  static async getProductsByName(req: Request, res: Response) {
    try {
      const { tenantName } = req.params;
      
      const tenantId = await TenantService.getTenantIdByName(tenantName);
      if (!tenantId) {
        return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
      }
      
      const filters = req.query;
      
      const [products, settings] = await Promise.all([
        PublicProductService.getProducts(tenantId.toString(), filters),
        new DataEngine(tenantId, process.env.SYSTEM_TOKEN || 'BOOTSTRAP_TOKEN').getNamespace('settings')
      ]);
      
      res.json({
        success: true,
        tenantName,
        tenantId,
        count: products.length,
        settings,
        data: products
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async checkStoreNameAvailability(req: Request, res: Response) {
    try {
      const { storeNameSlug } = req.params;
      const tenantId = await TenantService.getTenantIdByName(storeNameSlug);
      
      res.json({
        success: true,
        isAvailable: tenantId === null,
        message: tenantId === null ? 'Nombre de tienda disponible' : 'Nombre de tienda ya en uso'
      });
    } catch (error: any) {
      console.error('Error checking store name availability:', error);
      res.status(500).json({ success: false, isAvailable: false, message: 'Error interno del servidor' });
    }
  }

  static async getStoreDetailsByName(req: Request, res: Response) {
    try {
      const { tenantName } = req.params;
      
      const tenantId = await TenantService.getTenantIdByName(tenantName);
      if (!tenantId) {
        return res.status(404).json({ success: false, message: 'Tienda no encontrada' });
      }
      
      // Reutilizamos la lógica de getStoreDetails pasando el ID resuelto
      req.params.tenantId = tenantId.toString();
      return PublicStoreController.getStoreDetails(req, res);
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getStoreDetails(req: Request, res: Response) {
    try {
      const { tenantId } = req.params;
      
      const [config, tenantName] = await Promise.all([
        TenantService.getTenantConfig(tenantId),
        TenantService.getTenantName(tenantId)
      ]);
      
      if (!config) {
        return res.status(404).json({ success: false, message: 'Configuración no encontrada' });
      }

      res.json({
        success: true,
        tenantName,
        settings: config.settings,
        store_info: config.settings?.store_info
      });
    } catch (error: any) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

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
