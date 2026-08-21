"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const DataEngine_1 = require("../core/DataEngine");
async function setupModels() {
    const engine = new DataEngine_1.DataEngine(12, 'BOOTSTRAP_TOKEN');
    const data = await engine.getNamespace('dynamic_catalog');
    // Buscar IDs de marcas en los valores ya cargados
    const brandMap = {};
    for (const [id, val] of Object.entries(data.values)) {
        const v = val;
        if (v.field_id === 'field_1') { // field_1 es Marca
            brandMap[v.value] = id;
        }
    }
    console.log('🏗️ Cargando modelos...');
    const models = [
        { name: 'J1', brand: 'Samsung' },
        { name: 'J2', brand: 'Samsung' },
        { name: 'G8', brand: 'Motorola' },
        { name: 'E7', brand: 'Motorola' }
    ];
    for (const m of models) {
        const brandId = brandMap[m.brand];
        if (brandId) {
            const modelId = await engine.createValue('field_2', m.name, brandId); // field_2 es Modelo
            console.log(`✅ Modelo ${m.name} cargado con ID ${modelId} vinculado a Marca ${m.brand} (${brandId})`);
        }
    }
}
setupModels().catch(console.error);
