"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compositionModule = exports.CompositionModule = void 0;
class CompositionModule {
    // Calcula el precio total basado en el precio base del producto y los componentes seleccionados
    calculateTotal(basePrice, optionsSchema, selections) {
        let subtotal = basePrice;
        const details = [];
        for (const selection of selections) {
            const component = optionsSchema.components.find(c => c.name === selection.name);
            if (component) {
                const componentTotal = component.price * selection.quantity;
                subtotal += componentTotal;
                details.push({
                    name: component.name,
                    price: component.price,
                    quantity: selection.quantity,
                    subtotal: componentTotal
                });
            }
        }
        return { subtotal, details };
    }
    // Valida si la selección es correcta según el esquema (ej. max_choices)
    validateSelections(optionsSchema, selections) {
        if (optionsSchema.max_choices && selections.length > optionsSchema.max_choices) {
            return { valid: false, message: `Has superado el límite de ${optionsSchema.max_choices} elecciones.` };
        }
        for (const selection of selections) {
            if (!optionsSchema.components.find(c => c.name === selection.name)) {
                return { valid: false, message: `El componente ${selection.name} no es válido.` };
            }
        }
        return { valid: true };
    }
}
exports.CompositionModule = CompositionModule;
exports.compositionModule = new CompositionModule();
