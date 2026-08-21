"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const http_1 = __importDefault(require("http"));
const app_1 = __importDefault(require("./app"));
const staff_1 = require("./modules/staff");
const stock_1 = require("./modules/stock");
const sales_1 = require("./modules/sales");
const billing_1 = require("./modules/billing");
const compatibility_1 = require("./modules/compatibility");
const search_1 = require("./modules/search");
const settings_1 = require("./modules/settings");
const system_1 = require("./modules/system");
const business_1 = require("./modules/business");
const crm_1 = require("./modules/crm");
const operations_1 = require("./modules/operations");
const registration_1 = require("./modules/registration");
const import_1 = require("./modules/import");
async function bootstrap() {
    try {
        console.log('🚀 Starting Business Logic Engine V2...');
        // Importar módulos para registrar sus comandos en el dispatcher
        // El simple hecho de importar la instancia ejecuta el constructor y registra los comandos
        console.log('📦 Loading modules...');
        staff_1.staffModule;
        stock_1.stockModule;
        sales_1.salesModule;
        billing_1.billingModule;
        system_1.systemModule;
        business_1.businessModule;
        crm_1.crmModule;
        operations_1.operationsModule;
        registration_1.registrationModule;
        import_1.importModule;
        compatibility_1.compatibilityModule;
        search_1.searchModule;
        settings_1.settingsModule;
        const port = parseInt(process.env.PORT || '9002', 10);
        const server = http_1.default.createServer(app_1.default);
        server.listen(port, '0.0.0.0', () => {
            console.log(`✅ V2 Server running on http://0.0.0.0:${port}`);
            console.log(`🛠️  Core: InfraClient + Dispatcher + RBAC Active`);
            console.log(`💳 Billing Guard: Enabled`);
        });
    }
    catch (error) {
        console.error('❌ Critical failure during bootstrap:', error);
        process.exit(1);
    }
}
bootstrap();
