"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrationModule = void 0;
const Dispatcher_1 = require("../../core/Dispatcher");
const InfraClient_1 = require("../../core/InfraClient");
class RegistrationModule {
    constructor() {
        this.registerCommands();
    }
    registerCommands() {
        Dispatcher_1.dispatcher.register('APP:self-register', {
            name: 'APP:self-register',
            description: 'Registra un nuevo cliente y usuario administrador',
            requiredRole: 'GUEST'
        }, this.selfRegister);
    }
    async selfRegister(context, params) {
        try {
            const res = await InfraClient_1.infraClient.execute('APP:self-register', params, '');
            if (!res.success)
                return res;
            return {
                success: true,
                message: 'Registration successful',
                data: res.data
            };
        }
        catch (e) {
            return { success: false, message: e.message || 'Registration error' };
        }
    }
}
exports.registrationModule = new RegistrationModule();
