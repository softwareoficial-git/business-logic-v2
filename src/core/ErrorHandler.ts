export enum ErrorSource {
  INFRASTRUCTURE = "INFRASTRUCTURE",
  VALIDATION = "VALIDATION",
  BUSINESS_RULE = "BUSINESS_RULE",
  AUTH = "AUTH",
  INTERNAL = "INTERNAL",
}

export interface AppError {
  message: string;
  code: string;
  source: ErrorSource;
  statusCode: number;
  details?: any;
}

export class ErrorHandler {
  private static USER_MESSAGES: Record<string, string> = {
    PLAN_EXPIRED:
      "Tu suscripción ha expirado. Por favor, contacta con soporte para renovar tu plan.",
    INVALID_PATH_TYPE:
      "Error de estructura de datos. El campo solicitado no tiene el formato correcto.",
    INFRA_ERROR:
      "Hubo un problema de comunicación con la base de datos. Inténtalo de nuevo.",
    AUTH_FAILED:
      "Sesión no válida o expirada. Por favor, inicia sesión nuevamente.",
    VALIDATION_ERROR:
      "Los datos enviados no son válidos. Revisa los campos marcados.",
    INSUFFICIENT_STOCK:
      "No hay stock suficiente para completar esta operación.",
    USER_NOT_FOUND: "El usuario especificado no existe.",
  };

  public static handle(error: any): AppError {
    // Si ya es un AppError, lo devolvemos
    if (error && typeof error === "object" && "source" in error) {
      return error as AppError;
    }

    // Manejo de errores de InfraClient
    if (error?.error?.code) {
      return {
        message: error.message,
        code: error.error.code,
        source: ErrorSource.INFRASTRUCTURE,
        statusCode: 400,
        details: error.error.details,
      };
    }

    // Error genérico
    return {
      message: error?.message || "An unexpected error occurred",
      code: "INTERNAL_SERVER_ERROR",
      source: ErrorSource.INTERNAL,
      statusCode: 500,
    };
  }

  public static formatForFrontend(error: AppError) {
    return {
      success: false,
      message: error.message,
      user_message:
        this.USER_MESSAGES[error.code] ||
        "Ha ocurrido un error inesperado. Por favor, intenta más tarde.",
      error: {
        code: error.code,
        source: error.source,
        details: error.details,
      },
    };
  }
}
