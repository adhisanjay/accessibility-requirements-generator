function containsSecret(value) {
    if (/sk-[A-Za-z0-9_-]{12,}|\bbearer\s+\S+/i.test(value))
        return true;
    return Object.entries(process.env).some(([name, secret]) => typeof secret === "string" && secret.length > 0 &&
        /secret|token|password|api.?key|credential|auth/i.test(name) &&
        value.includes(secret));
}
function asRecord(value) {
    return typeof value === "object" && value !== null
        ? value
        : {};
}
function safeIdentifier(value) {
    return typeof value === "string" &&
        /^[A-Za-z0-9_.-]{1,80}$/.test(value) &&
        !containsSecret(value)
        ? value
        : null;
}
function requestIdFrom(error) {
    const headers = asRecord(error.headers);
    const headerGetter = error.headers;
    const value = error.request_id ?? error.requestID ??
        headers["x-request-id"] ?? headers["X-Request-Id"] ??
        headerGetter?.get?.("x-request-id");
    return typeof value === "string" &&
        /^[A-Za-z0-9_-]{1,128}$/.test(value) &&
        !containsSecret(value)
        ? value
        : null;
}
function messageFor(category) {
    switch (category) {
        case "timeout": return "The OpenAI request timed out.";
        case "authentication": return "OpenAI authentication failed.";
        case "quota": return "The OpenAI account has insufficient quota or a billing limit.";
        case "rate_limit": return "The OpenAI rate limit was reached.";
        case "model_unavailable": return "The configured OpenAI model is unavailable to this account.";
        case "invalid_request": return "OpenAI rejected the request or structured-output schema.";
        case "network": return "The API could not connect to OpenAI.";
        default: return "The OpenAI provider request failed.";
    }
}
export function classifyProviderError(error) {
    const record = asRecord(error);
    const providerError = asRecord(record.error);
    const statusCode = typeof record.status === "number" &&
        Number.isInteger(record.status) && record.status >= 100 && record.status <= 599
        ? record.status
        : null;
    const openaiErrorType = safeIdentifier(record.type ?? providerError.type);
    const openaiErrorCode = safeIdentifier(record.code ?? providerError.code);
    const name = error instanceof Error ? error.name : safeIdentifier(record.name) ?? "";
    const message = [
        error instanceof Error ? error.message : "",
        typeof providerError.message === "string" ? providerError.message : "",
        openaiErrorType ?? "",
        openaiErrorCode ?? "",
    ].join(" ").toLowerCase();
    let category = "provider";
    if (statusCode === 408 ||
        /timeout|timed out|etimedout|econnaborted/i.test(`${name} ${message} ${openaiErrorCode ?? ""}`)) {
        category = "timeout";
    }
    else if (openaiErrorCode === "insufficient_quota" ||
        openaiErrorType === "insufficient_quota" ||
        /insufficient quota|billing limit|credit balance|payment required/i.test(message)) {
        category = "quota";
    }
    else if (openaiErrorCode === "model_not_found" ||
        /model.{0,40}(not found|unavailable|not available)/i.test(message)) {
        category = "model_unavailable";
    }
    else if (statusCode === 401 || statusCode === 403 || /invalid_api_key|authentication_error/i.test(message)) {
        category = "authentication";
    }
    else if (statusCode === 429 || /rate_limit_exceeded|rate_limit_error/i.test(message)) {
        category = "rate_limit";
    }
    else if (statusCode === 400 ||
        openaiErrorType === "invalid_request_error" ||
        /invalid_json_schema|response_format|structured.output|invalid request/i.test(message)) {
        category = "invalid_request";
    }
    else if (/apiconnectionerror|econnreset|econnrefused|enotfound|eai_again|networkerror|fetch failed/i.test(`${name} ${message} ${openaiErrorCode ?? ""}`)) {
        category = "network";
    }
    return {
        category,
        statusCode,
        openaiErrorType,
        openaiErrorCode,
        requestId: requestIdFrom(record),
        safeMessage: messageFor(category),
    };
}
export function logProviderErrorDiagnostic(error) {
    if (process.env.NODE_ENV === "production")
        return;
    console.warn("[analysis-provider-diagnostic]", JSON.stringify(classifyProviderError(error)));
}
