"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DataEngine_1 = require("../core/DataEngine");
const crypto_1 = require("crypto");
async function addCodigoId() {
    const engine = new DataEngine_1.DataEngine(12, 'BOOTSTRAP_TOKEN');
    const productos = await engine.getNamespace('productos');
    let updatedCount = 0;
    for (const key in productos) {
        if (!productos[key].codigo_id) {
            productos[key].codigo_id = (0, crypto_1.randomUUID)();
            updatedCount++;
        }
    }
    if (updatedCount > 0) {
        await engine.saveNamespace('productos', productos);
        console.log(`✅ ${updatedCount} productos actualizados con un nuevo codigo_id.`);
    }
    else {
        console.log('ℹ️ Todos los productos ya tenían un codigo_id.');
    }
}
addCodigoId().catch(console.error);
