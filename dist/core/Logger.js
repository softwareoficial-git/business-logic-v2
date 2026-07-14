"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.ErrorSource = exports.LogLevel = void 0;
var LogLevel;
(function (LogLevel) {
    LogLevel["INFO"] = "INFO";
    LogLevel["WARN"] = "WARN";
    LogLevel["ERROR"] = "ERROR";
    LogLevel["CRITICAL"] = "CRITICAL";
    LogLevel["DEBUG"] = "DEBUG";
})(LogLevel || (exports.LogLevel = LogLevel = {}));
var ErrorSource;
(function (ErrorSource) {
    ErrorSource["INFRASTRUCTURE"] = "INFRASTRUCTURE";
    ErrorSource["BACKEND_LOGIC"] = "BACKEND_LOGIC";
    ErrorSource["VALIDATION"] = "VALIDATION";
    ErrorSource["BUSINESS_RULE"] = "BUSINESS_RULE";
    ErrorSource["UNKNOWN"] = "UNKNOWN";
})(ErrorSource || (exports.ErrorSource = ErrorSource = {}));
class Logger {
    info(message, context) {
        console.log(`\x1b[32m[INFO]\x1b[0m ${message}`, context || "");
    }
    warn(message, context) {
        console.log(`\x1b[33m[WARN]\x1b[0m ${message}`, context || "");
    }
    error(message, source, context) {
        console.log(`\x1b[31m[ERROR][${source}]\x1b[0m ${message}`, context || "");
    }
    debug(message, context) {
        console.log(`\x1b[36m[DEBUG]\x1b[0m ${message}`, context || "");
    }
}
exports.logger = new Logger();
