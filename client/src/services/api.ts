import axios, { AxiosHeaders } from "axios"
import type { ApiError } from "../types"

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || "/api"

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000
})

export const api = apiClient

let getAuthStore: (() => {
  accessToken: string | null
  expiresAt: number | null
  isRefreshing: boolean
  refreshAccessToken: () => Promise<void>
  handleAuthRequired: () => Promise<void>
}) | null = null

// Queue for pending requests during refresh
let failedQueue: Array<{
  resolve: (token: string | null) => void
  reject: (error: any) => void
}> = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

export const setupApiInterceptors = (
  authGetter: () => {
    accessToken: string | null
    expiresAt: number | null
    isRefreshing: boolean
    refreshAccessToken: () => Promise<void>
    handleAuthRequired: () => Promise<void>
  }
) => {
  getAuthStore = authGetter

  apiClient.interceptors.request.use(async (config) => {
    const authStore = getAuthStore?.()
    if (authStore?.accessToken) {
      // Proactive Token Expiration Check
      // If token expires in less than 10 seconds, try to refresh
      if (authStore.expiresAt && Date.now() > authStore.expiresAt - 10000) {
        if (!authStore.isRefreshing) {
           // We don't await this strictly for concurrency reasons managed by store,
           // BUT we want to wait for the result before sending THIS request.
           try {
             await authStore.refreshAccessToken()
           } catch (e) {
             // If refresh fails, we let the request proceed? 
             // Or fail early? If we proceed, it will likely 401.
             // Let's let it proceed to standard 401 handling which handles redirect.
             console.warn('Proactive refresh failed', e)
           }
        }
      }

      const headers = config.headers || new AxiosHeaders()
      const merged = headers instanceof AxiosHeaders ? headers : AxiosHeaders.from(headers)
      // Re-read token after potential refresh
      const token = getAuthStore?.()?.accessToken || authStore.accessToken
      merged.set("Authorization", `Bearer ${token}`)
      config.headers = merged
    }
    return config
  })

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const authStore = getAuthStore?.()
      const originalRequest = error.config
      const status = error?.response?.status
      const data = error?.response?.data as ApiError | undefined

      // 如果是 401 且未重试过
      if (status === 401 && !originalRequest._retry) {
        if (authStore?.isRefreshing) {
           // Add to queue
           return new Promise((resolve, reject) => {
             failedQueue.push({ resolve, reject })
           })
           .then((token) => {
             const newHeaders = new AxiosHeaders(originalRequest.headers)
             newHeaders.set("Authorization", `Bearer ${token}`)
             originalRequest.headers = newHeaders
             return apiClient(originalRequest)
           })
           .catch((err) => {
             return Promise.reject(err)
           })
        }

        originalRequest._retry = true
        
        if (authStore) {
          try {
            // 尝试刷新 token
            await authStore.refreshAccessToken()
            const newToken = authStore.accessToken
            
            // Process queue
            processQueue(null, newToken)
            
            // 刷新成功后，更新 header 并重发原请求
            const newHeaders = new AxiosHeaders(originalRequest.headers)
            newHeaders.set("Authorization", `Bearer ${newToken}`)
            originalRequest.headers = newHeaders
            return apiClient(originalRequest)
          } catch (refreshError) {
            // Process queue with error
            processQueue(refreshError, null)
            
            // 刷新失败，则触发全端登出/切回匿名
            await authStore.handleAuthRequired()
            return Promise.reject(refreshError)
          }
        }
      }
      
      // 如果是非 401 的 AUTH_REQUIRED（虽然通常 AUTH_REQUIRED 伴随 401，但以防万一）
      if (data?.code === "AUTH_REQUIRED") {
        if (authStore) {
          await authStore.handleAuthRequired()
        }
      }
      return Promise.reject(error)
    }
  )
}
