import { dispatcher } from '../../core/Dispatcher';
import { infraClient, ServiceResponse } from '../../core/InfraClient';
import { RequestContext } from '../../core/RequestContext';

class SalesModule {
  constructor() {
    this.registerCommands();
  }

  private registerCommands() {
    // Procesar Venta (Checkout)
    dispatcher.register('sales.checkout', {
      name: 'sales.checkout',
      description: 'Procesa una venta: valida stock, descuenta y registra venta',
      requiredRole: 'EMPLEADO'
    }, this.checkout);

    // Crear Orden de Venta y Link de Pago
    dispatcher.register('sales.create', {
      name: 'sales.create',
      description: 'Crea una orden de venta y genera un link de pago',
      requiredRole: 'EMPLEADO'
    }, this.createOrder);

    // Confirmar Pago
    dispatcher.register('sales.confirm_payment', {
      name: 'sales.confirm_payment',
      description: 'Confirma el pago de una orden y descuenta el stock',
      requiredRole: 'EMPLEADO'
    }, this.confirmPayment);

    // Historial de Ventas
    dispatcher.register('sales.history', {
      name: 'sales.history',
      description: 'Obtiene el historial de ventas de la empresa',
      requiredRole: 'DUEÑO'
    }, this.getHistory);

    // Resumen Consolidado de Ventas
    dispatcher.register('sales.summary', {
      name: 'sales.summary',
      description: 'Obtiene el resumen consolidado de ventas por vendedor',
      requiredRole: 'DUEÑO'
    }, this.getSummary);

    // Obtener Resumen Mensual de Ventas
    dispatcher.register('sales.get_monthly_summary', {
      name: 'sales.get_monthly_summary',
      description: 'Obtiene un resumen de ventas agrupado por mes',
      requiredRole: 'DUEÑO'
    }, this.getMonthlySummary);

    // Obtener Total de Ventas del Día
    dispatcher.register('sales.get_daily_total', {
      name: 'sales.get_daily_total',
      description: 'Calcula el total de ventas y tickets del día actual',
      requiredRole: 'DUEÑO'
    }, this.getDailyTotal);
  }

  private async checkout(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { items, customerId, clientTimestamp, client_request_id, ticket } = params;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return { success: false, message: 'La lista de items es requerida' };
    }

    // 1. Leer Stock
    const stockRes = await infraClient.readPath<any[]>(context.tenantId, 'stock', context.token);
    if (!stockRes.success) return stockRes;
    const stock = stockRes.data || [];

    // 2. Validar Stock y preparar venta
    const soldItems = [];
    let totalSale = 0;

    for (const item of items) {
      const index = stock.findIndex(p => p.code === item.code);
      if (index === -1) {
        console.log(`[DEBUG] Producto no encontrado:`, item.code);
        return { success: false, message: `Producto ${item.code} no encontrado` };
      }

      const product = stock[index];
      if (product.qty < item.qty) {
        console.log(`[DEBUG] Stock insuficiente para:`, product.name, 'Necesita:', item.qty, 'Tiene:', product.qty);
        return { success: false, message: `Stock insuficiente para ${product.name}` };
      }

      soldItems.push({ product_code: product.code, name: product.name, qty: item.qty, price: product.price });
      totalSale += (product.price * item.qty);
    }

    // 3. Ejecutar actualizaciones
    for (const item of items) {
      const index = stock.findIndex(p => p.code === item.code);
      const product = stock[index];
      const updatedProduct = { ...product, qty: product.qty - item.qty };
      const updateRes = await infraClient.updatePath(context.tenantId, `stock.${index}`, updatedProduct, context.token);
      if (!updateRes.success) return updateRes;
    }

    // 4. Crear registro de venta (usando ticket si viene del front, o generando uno)
    const saleId = `ORD-${Date.now()}`;
    const saleRecord = {
      id: saleId,
      total: totalSale,
      items: soldItems,
      customerId,
      empleado: context.userId, // Guardamos ID del usuario
      role: context.role,       // Guardamos el rol
      createdAt: clientTimestamp || new Date().toISOString(),
      ticket: ticket || { items: soldItems, total_ticket: totalSale } // Persistimos el ticket
    };
    
    await infraClient.pushItem(context.tenantId, 'sales', saleRecord, context.token);

    // 5. Emitir evento único de auditoría
    await infraClient.execute('SYSTEM:log-event', {
      status: 'SUCCESS',
      command: 'sales.checkout-consolidated',
      tenantId: context.tenantId,
      userId: context.userId,
      details: {
        fecha: saleRecord.createdAt,
        resumen: `Venta: Total $${totalSale}`,
        detalle: { 
          total: totalSale, 
          ticket: saleRecord.ticket, 
          client_request_id 
        }
      }
    }, context.token);

    return { 
      success: true, 
      message: 'Venta procesada.', 
      data: { sale_id: saleId, total: totalSale } 
    };
  }

  private async createOrder(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { items, total, account_alias, client_request_id, clientTimestamp } = params;

    // 1. Idempotency Check
    if (client_request_id) {
      const res = await infraClient.queryJson<any>(context.tenantId, 'sales', { client_request_id }, context.token);
      if (res.success && res.data && res.data.length > 0) {
        return { success: true, message: 'Sale already registered.', data: { sale_id: res.data[0].id } };
      }
    }

    // 2. Sales Order
    const saleId = `ORD-${Date.now()}`;
    const saleRecord = {
      id: saleId,
      total,
      payment_status: 'pending',
      client_request_id,
      empleado: context.userId, // Guardamos ID del usuario
      role: context.role,       // Guardamos el rol
      createdAt: clientTimestamp || new Date().toISOString()
    };

    const saleRes = await infraClient.pushItem(context.tenantId, 'sales', saleRecord, context.token);
    if (!saleRes.success) return saleRes;

    // 3. Items (Stored as a separate list)
    if (Array.isArray(items)) {
      const orderItems = items.map((item: any) => ({
        sale_id: saleId,
        product_code: item.code,
        quantity: item.quantity,
        price: item.price,
        subtotal: item.price * item.quantity
      }));

      for (const item of orderItems) {
        await infraClient.pushItem(context.tenantId, 'sale_items', item, context.token);
      }
    }

    // 4. Mock Payment Link
    const paymentLink = `https://api.payments.com/pay/${saleId}`;

    // 5. Actualización Quirúrgica del Link de Pago
    // Ya no leemos todo el array de órdenes, buscamos la posición y actualizamos solo el campo.
    const ordersRes = await infraClient.readPath<any[]>(context.tenantId, 'sales', context.token);
    if (ordersRes.success && Array.isArray(ordersRes.data)) {
      const orders = ordersRes.data;
      const idx = orders.findIndex(o => o.id === saleId);
      if (idx !== -1) {
        await infraClient.updatePath(context.tenantId, `sales[${idx}].payment_link`, paymentLink, context.token);
      }
    }

    return {
      success: true,
      message: 'Sale created successfully.',
      data: { payment_link: paymentLink, sale_id: saleId }
    };
  }

  private async confirmPayment(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { sale_id } = params;
    if (!sale_id) return { success: false, message: 'sale_id is required' };

    return infraClient.execute('CONFIRM_SALE_PAYMENT', {
      sale_id,
      user_id: context.userId,
      tenantId: context.tenantId
    }, context.token);
  }

  private async getSummary(context: RequestContext, params: any): Promise<ServiceResponse> {
    const ordersRes = await infraClient.readPath<any[]>(context.tenantId, 'sales', context.token);

    if (!ordersRes.success) return ordersRes;

    const orders = ordersRes.data || [];

    const summary: any = {
      total_ventas_24h: 0,
      detalle_por_empleado: {}
    };

    orders.forEach(order => {
      // Identificar si la venta fue realizada por el DUEÑO o un empleado
      let empleado = 'Desconocido';
      if (order.role === 'DUEÑO') {
        empleado = 'Dueño';
      } else if (order.empleado) {
        empleado = `Empleado (${order.empleado})`;
      }

      if (!summary.detalle_por_empleado[empleado]) {
        summary.detalle_por_empleado[empleado] = {
          productos: [],
          total_empleado: 0
        };
      }

      // Normalización robusta para capturar items independientemente del formato
      let orderItems: any[] = [];
      if (order.items && Array.isArray(order.items)) {
        orderItems = order.items;
      } else if (order.ticket && order.ticket.items && Array.isArray(order.ticket.items)) {
        orderItems = order.ticket.items;
      }
      
      orderItems.forEach((item: any) => {
        // Normalización de campos: manejar tanto {name, qty, price} como {producto, cantidad, monto}
        const nombre = item.name || item.producto || 'Producto';
        const cantidad = Number(item.qty || item.cantidad || 0);
        
        // Calcular subtotal de forma segura
        let subtotal = 0;
        if (item.price !== undefined && item.qty !== undefined) {
          subtotal = Number(item.price) * Number(item.qty);
        } else if (item.monto !== undefined) {
          subtotal = Number(item.monto);
        }

        summary.detalle_por_empleado[empleado].productos.push({
          producto: nombre,
          cantidad: cantidad,
          monto: subtotal
        });
        
        summary.detalle_por_empleado[empleado].total_empleado += subtotal;
        summary.total_ventas_24h += subtotal;
      });
    });

    return { success: true, message: 'Resumen obtenido correctamente', data: { summary } };
  }

  private async getHistory(context: RequestContext, params: any): Promise<ServiceResponse> {
    const res = await infraClient.readPath(context.tenantId, 'sales', context.token);
    if (!res.success && res.error?.code === 'PATH_NOT_FOUND') {
      return { success: true, message: 'No sales history found', data: [] };
    }
    return res;
  }

  private async getMonthlySummary(context: RequestContext, params: any): Promise<ServiceResponse> {
    const { month, year } = params; // month es 1-12, year es 2026, etc.
    const targetMonth = month ? Number(month) : new Date().getMonth() + 1;
    const targetYear = year ? Number(year) : new Date().getFullYear();

    const res = await infraClient.readPath<any[]>(context.tenantId, 'sales', context.token);
    if (!res.success) return res;
    const allSales = res.data || [];

    let totalSales = 0;
    let totalTickets = 0;
    const salesByMonth: { [key: string]: number } = {};
    const topProducts: { [key: string]: { qty: number; total: number } } = {};

    allSales.forEach(sale => {
      const saleDate = new Date(sale.createdAt);
      const saleMonth = saleDate.getMonth() + 1; // getMonth() es 0-11
      const saleYear = saleDate.getFullYear();

      if (saleMonth === targetMonth && saleYear === targetYear) {
        totalSales += Number(sale.total || 0);
        totalTickets += 1;

        // Acumular ventas por mes (para el widget si se desea)
        const monthKey = `${saleYear}-${String(saleMonth).padStart(2, '0')}`;
        salesByMonth[monthKey] = (salesByMonth[monthKey] || 0) + Number(sale.total || 0);

        // Acumular productos más vendidos
        const items = sale.items || (sale.ticket ? sale.ticket.items : []);
        items.forEach((item: any) => {
          const productName = item.name || item.producto || 'Desconocido';
          const qty = Number(item.qty || item.cantidad || 0);
          const itemTotal = Number(item.price || item.monto || 0) * qty;
          
          if (!topProducts[productName]) {
            topProducts[productName] = { qty: 0, total: 0 };
          }
          topProducts[productName].qty += qty;
          topProducts[productName].total += itemTotal;
        });
      }
    });

    const sortedTopProducts = Object.entries(topProducts)
      .sort(([, a], [, b]) => b.total - a.total)
      .map(([name, data]) => ({ name, ...data }));

    return {
      success: true,
      message: 'Resumen mensual de ventas obtenido',
      data: {
        month: targetMonth,
        year: targetYear,
        totalSales: Number(totalSales.toFixed(2)),
        totalTickets,
        topProducts: sortedTopProducts,
        salesByMonth // Podría ser útil para gráficos
      }
    };
  }

  private async getDailyTotal(context: RequestContext, params: any): Promise<ServiceResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Inicio del día

    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1); // Inicio del día siguiente

    const res = await infraClient.readPath<any[]>(context.tenantId, 'sales', context.token);
    if (!res.success) return res;
    const allSales = res.data || [];

    let dailySalesTotal = 0;
    let totalTicketsToday = 0;

    allSales.forEach(sale => {
      const saleDate = new Date(sale.createdAt);
      if (saleDate >= today && saleDate < tomorrow) {
        dailySalesTotal += Number(sale.total || 0);
        totalTicketsToday += 1;
      }
    });

    return {
      success: true,
      message: 'Total de ventas del día obtenido',
      data: {
        dailySalesTotal: Number(dailySalesTotal.toFixed(2)),
        totalTicketsToday
      }
    };
  }
}

export const salesModule = new SalesModule();

