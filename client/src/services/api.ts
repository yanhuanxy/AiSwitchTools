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
  refreshAccessToken: () => Promise<void>
  handleAuthRequired: () => Promise<void>
}) | null = null

export const setupApiInterceptors = (
  authGetter: () => {
    accessToken: string | null
    refreshAccessToken: () => Promise<void>
    handleAuthRequired: () => Promise<void>
  }
) => {
  getAuthStore = authGetter

  apiClient.interceptors.request.use((config) => {
    const authStore = getAuthStore?.()
    if (authStore?.accessToken) {
      const headers = config.headers || new AxiosHeaders()
      const merged = headers instanceof AxiosHeaders ? headers : AxiosHeaders.from(headers)
      merged.set("Authorization", `Bearer ${authStore.accessToken}`)
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
        originalRequest._retry = true
        if (authStore) {
          try {
            // 尝试刷新 token
            await authStore.refreshAccessToken()
            // 刷新成功后，更新 header 并重发原请求
            const newHeaders = new AxiosHeaders(originalRequest.headers)
            newHeaders.set("Authorization", `Bearer ${authStore.accessToken}`)
            originalRequest.headers = newHeaders
            return apiClient(originalRequest)
          } catch (refreshError) {
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
