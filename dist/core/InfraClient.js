"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.infraClient = void 0;
const axios_1 = __importDefault(require("axios"));
class InfraClient {
    constructor() {
        this.baseUrl = process.env.DB_URL || "http://localhost:3001";
        this.httpClient = axios_1.default.create({
            baseURL: this.baseUrl,
            timeout: 15000,
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${process.env.DB_TOKEN || ""}`,
            },
        });
    }
    async execute(cmd, payload, token) {
        try {
            const requestBody = {
                command: cmd,
                payload: payload,
            };
            if (token) {
                requestBody.token = token;
            }
            const response = await this.httpClient.post("/execute", requestBody);
            const result = response.data;
            //...
            console.log(`[INFRA_RESPONSE] CMD: ${cmd} | STATUS: ${result.status} | DATA:`, JSON.stringify(result.data, null, 2));
            if (result.status === "success") {
                const finalData = result.data &&
                    typeof result.data === "object" &&
                    "value" in result.data
                    ? result.data.value
                    : result.data;
                return {
                    success: true,
                    message: result.message || "Operation successful",
                    data: finalData,
                };
            }
            else {
                return {
                    success: false,
                    message: result.error?.message ||
                        "La infraestructura devolvió un error en la ejecución del comando.",
                    error: {
                        code: result.error?.code || "INFRA_EXECUTION_ERROR",
                        message: result.error?.message ||
                            "Se produjo un error interno en el motor de infraestructura al procesar la solicitud.",
                        details: result.error?.details,
                    },
                };
            }
        }
        catch (error) {
            return {
                success: false,
                message: error.response?.data?.error?.message ||
                    error.message ||
                    "No se pudo establecer conexión con el servidor de infraestructura.",
                error: {
                    code: error.response?.data?.error?.code || "INFRA_CONNECTION_ERROR",
                    message: error.message,
                },
            };
        }
    }
    async readPath(clienteId, path, token) {
        return this.execute("USER:read-path", { clienteId, path }, token);
    }
    async updatePath(clienteId, path, value, token) {
        return this.execute("USER:update-path", { clienteId, path, value }, token);
    }
    async pushItem(clienteId, path, item, token) {
        return this.execute("USER:push-item", { clienteId, path, item }, token);
    }
    async batch(commands, token) {
        return this.execute("SYSTEM:batch", { commands }, token);
    }
    async queryJson(clienteId, path, filter, token) {
        return this.execute("USER:query-json", { clienteId, path, filter }, token);
    }
}
exports.infraClient = new InfraClient();
