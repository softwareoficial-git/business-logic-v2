"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const DataEngine_1 = require("../core/DataEngine");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
async function importStock() {
    const engine = new DataEngine_1.DataEngine(12, 'BOOTSTRAP_TOKEN'); // Cliente RedMovil (ID 12)
    const csvPath = path.join(__dirname, '../../precios_redmovil.csv');
    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
    const productos = {};
    const stock = {};
    const compat = { product_to_models: {}, model_to_products: {} };
    let currentBrand = '';
    for (const line of lines) {
        if (!line.trim())
            continue;
        const [rawName, rawPrice, ...rest] = line.split(',');
        // Detectar Marca (encabezado)
        if (rawName && !rawPrice) {
            currentBrand = rawName.trim();
            continue;
        }
        // Normalizar Producto
        const price = parseInt(rawPrice) || 0;
        const name = rawName.trim();
        const code = name.toLowerCase().replace(/\s+/g, '_');
        // Extraer atributos
        const qualityMatch = name.match(/(incell|AAA|Original|SERVICE PACK|oled|VEZR)/i);
        const frameMatch = name.match(/(c\/marco|c\/m)/i);
        const product = {
            code,
            name,
            category: currentBrand,
            price,
            metadata: {
                marca: currentBrand,
                calidad: qualityMatch ? qualityMatch[0] : 'Standard',
                marco: frameMatch ? 'con marco' : 'sin marco'
            }
        };
        productos[code] = product;
        stock[code] = { code, qty: 10 }; // Stock inicial por defecto
        // Desglosar compatibilidad (si contiene '/')
        const models = name.split('/')[0].split(' '); // Simplificación para demo
        compat.product_to_models[code] = models;
        models.forEach(m => {
            if (!compat.model_to_products[m])
                compat.model_to_products[m] = [];
            compat.model_to_products[m].push(code);
        });
    }
    await engine.saveNamespace('productos', productos);
    await engine.saveNamespace('stock', stock);
    await engine.saveNamespace('compat', compat);
    console.log('✅ Datos cargados correctamente.');
}
importStock().catch(console.error);
