import axios, { AxiosInstance } from "axios";

export interface ServiceResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

class InfraClient {
  private httpClient: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl =
      process.env.DB_URL ||
      "https://infrastructure-engine-production.up.railway.app/";
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
    });
  }

  public async execute<T = any>(
    cmd: string,
    payload: any,
    token: string,
  ): Promise<ServiceResponse<T>> {
    try {
      const response = await this.httpClient.post("/execute", {
        token: token,
        cmd: cmd,
        payload: payload,
      });

      const result = response.data;
      console.log(
        `[INFRA_RESPONSE] CMD: ${cmd} | STATUS: ${result.status} | DATA:`,
        JSON.stringify(result.data, null, 2),
      );

      if (result.status === "success") {
        const finalData =
          result.data &&
          typeof result.data === "object" &&
          "value" in result.data
            ? result.data.value
            : result.data;

        return {
          success: true,
          message: result.message || "Operation successful",
          data: finalData,
        };
      } else {
        return {
          success: false,
          message: result.error?.message || "Infra Error",
          error: {
            code: result.error?.code || "INFRA_ERROR",
            message: result.error?.message || "Unknown error",
            details: result.error?.details,
          },
        };
      }
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.error?.message ||
          error.message ||
          "Network Error",
        error: {
          code: error.response?.data?.error?.code || "HTTP_ERROR",
          message: error.message,
        },
      };
    }
  }

  public async readPath<T = any>(
    clienteId: string | number,
    path: string,
    token: string,
  ): Promise<ServiceResponse<T>> {
    return this.execute<T>("USER:read-path", { clienteId, path }, token);
  }

  public async updatePath(
    clienteId: string | number,
    path: string,
    value: any,
    token: string,
  ): Promise<ServiceResponse> {
    return this.execute("USER:update-path", { clienteId, path, value }, token);
  }

  public async pushItem(
    clienteId: string | number,
    path: string,
    item: any,
    token: string,
  ): Promise<ServiceResponse> {
    // OPTIMIZACIÓN DE BLINDAJE: Eliminamos el ciclo Read-Modify-Write.
    // Delegamos la operación de 'push' directamente a Infra Engine usando su comando nativo.
    // Esto evita que el servidor V2 tenga que leer arrays gigantes, modificarlos y re-escribirlos,
    // eliminando colisiones en ventas simultáneas y optimizando la carga masiva.
    return this.execute("USER:push-item", { clienteId, path, item }, token);
  }

  public async queryJson<T = any>(
    clienteId: string | number,
    path: string,
    filter: any,
    token: string,
  ): Promise<ServiceResponse<T[]>> {
    return this.execute<T[]>(
      "USER:query-json",
      { clienteId, path, filter },
      token,
    );
  }
}

export const infraClient = new InfraClient();
