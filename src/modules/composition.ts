export interface Component {
    name: string;
    price: number;
}

export interface OptionsSchema {
    type: 'composition' | 'add-on';
    components: Component[];
    max_choices?: number;
}

export interface Selection {
    name: string;
    quantity: number;
}

export class CompositionModule {
    
    // Calcula el precio total basado en el precio base del producto y los componentes seleccionados
    public calculateTotal(basePrice: number, optionsSchema: OptionsSchema, selections: Selection[]): { subtotal: number, details: any[] } {
        let subtotal = basePrice;
        const details: any[] = [];

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
    public validateSelections(optionsSchema: OptionsSchema, selections: Selection[]): { valid: boolean, message?: string } {
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

export const compositionModule = new CompositionModule();
