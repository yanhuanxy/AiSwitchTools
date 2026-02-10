import { ElMessage } from "element-plus"

const messages: Record<string, Record<string, string>> = {
  "zh-CN": {
    AUTH_REQUIRED: "登录失效，已切换为匿名，可重新绑定",
    FORBIDDEN: "无权限访问",
    RATE_LIMITED: "请求过快，请稍后重试",
    MODEL_TIMEOUT: "模型超时，可重试",
    MODEL_UNAVAILABLE: "模型繁忙，请稍后重试",
    CONTENT_BLOCKED: "内容不支持，已保留输入",
    UPLOAD_FAILED: "上传失败，请重试",
    INVALID_PARAMS: "参数错误"
  },
  "en-US": {
    AUTH_REQUIRED: "Session expired, switched to anonymous",
    FORBIDDEN: "Forbidden",
    RATE_LIMITED: "Too many requests",
    MODEL_TIMEOUT: "Model timeout",
    MODEL_UNAVAILABLE: "Model unavailable",
    CONTENT_BLOCKED: "Content blocked",
    UPLOAD_FAILED: "Upload failed",
    INVALID_PARAMS: "Invalid parameters"
  }
}

export const getLocale = () => {
  const lang = navigator.language || "zh-CN"
  if (lang.startsWith("zh")) return "zh-CN"
  return "en-US"
}

export const getErrorMessage = (code?: string, fallback?: string) => {
  if (!code) return fallback || "未知错误"
  const locale = getLocale()
  return messages[locale]?.[code] || fallback || code
}

export const resolveError = (error: any, fallback?: string) => {
  const code = error?.response?.data?.code
  const traceId =
    error?.response?.data?.traceId ||
    error?.response?.headers?.["x-trace-id"] ||
    error?.response?.headers?.["trace-id"]
  const message = getErrorMessage(code, error?.message || fallback)
  return { code, traceId, message }
}

export const notifyError = (message: string, type: "success" | "warning" | "info" | "error" = "error") => {
  if (!message) return
  ElMessage({
    message,
    type,
    duration: 3500,
    showClose: true
  })
}

const reportUrl =
  import.meta.env.VITE_ERROR_REPORT_URL ||
  `${import.meta.env.VITE_API_BASE_URL || "/api"}/errors/report`
const reportEnabled = import.meta.env.VITE_ERROR_REPORT_ENABLED !== "false"

export const reportError = (payload: {
  code?: string
  message: string
  traceId?: string
  context?: string
  path?: string
}) => {
  if (!reportEnabled || !payload?.message) return
  try {
    const body = JSON.stringify({
      ...payload,
      time: new Date().toISOString(),
      userAgent: navigator.userAgent
    })
    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" })
      navigator.sendBeacon(reportUrl, blob)
    } else {
      fetch(reportUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true
      })
    }
  } catch {
    return
  }
}

export const handleError = (error: any, fallback?: string, context?: string) => {
  const { code, traceId, message } = resolveError(error, fallback)
  notifyError(message)
  reportError({ code, traceId, message, context, path: window.location.pathname })
  return message
}
