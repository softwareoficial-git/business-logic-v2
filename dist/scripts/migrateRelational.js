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
async function migrateRelational() {
    const engine = new DataEngine_1.DataEngine(12, 'BOOTSTRAP_TOKEN');
    const csvPath = path.join(__dirname, '../../precios_redmovil.csv');
    const lines = fs.readFileSync(csvPath, 'utf-8').split('\n');
    const brands = {};
    const models = {};
    const products = {};
    const stock = {};
    let brandCounter = 1;
    let modelCounter = 1;
    let currentBrandName = '';
    // Pass 1: Build Masters
    for (const line of lines) {
        if (!line.trim())
            continue;
        const [rawName, rawPrice] = line.split(',');
        if (rawName && !rawPrice) {
            currentBrandName = rawName.trim();
            if (!brands[currentBrandName])
                brands[currentBrandName] = brandCounter++;
            continue;
        }
        const modelsRaw = rawName.split('/')[0].trim();
        if (!models[modelsRaw]) {
            models[modelsRaw] = { id: modelCounter++, brand_id: brands[currentBrandName] };
        }
    }
    // Pass 2: Build Products
    for (const line of lines) {
        if (!line.trim())
            continue;
        const [rawName, rawPrice] = line.split(',');
        if (rawName && !rawPrice) {
            currentBrandName = rawName.trim();
            continue;
        }
        const price = parseInt(rawPrice) || 0;
        const name = rawName.trim();
        const code = name.toLowerCase().replace(/\s+/g, '_');
        // Split compatibility by / and map to model IDs
        const compatParts = rawName.split('/').map(p => p.trim());
        const modelIds = compatParts.map(part => models[part]?.id).filter(Boolean);
        products[code] = {
            code,
            name,
            model_ids: modelIds,
            metadata: {
                calidad: name.match(/(incell|AAA|Original|SERVICE PACK|oled|VEZR)/i)?.[0] || 'Standard',
                marco: name.match(/(c\/marco|c\/m)/i) ? 'con marco' : 'sin marco'
            }
        };
        stock[code] = { code, qty: 10 };
    }
    // Save everything
    await engine.saveNamespace('brands_master', brands);
    await engine.saveNamespace('models_master', models);
    await engine.saveNamespace('productos', products);
    await engine.saveNamespace('stock', stock);
    console.log('✅ Base de datos relacional establecida.');
}
migrateRelational().catch(console.error);
