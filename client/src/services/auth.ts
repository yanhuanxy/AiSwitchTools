import { apiClient } from "./api"

export type TokenResponse = {
  accessToken: string
  refreshToken: string
  expiresIn: number
  identityType?: string
  userId?: string
  tokenVersion?: number
}

export const requestAnonToken = async () => {
  const { data } = await apiClient.post<TokenResponse>("/auth/anon")
  return data
}

export const refreshToken = async (refreshToken: string) => {
  const { data } = await apiClient.post<TokenResponse>("/auth/token/refresh", {
    refreshToken
  })
  return data
}

export const logout = async () => {
  const { data } = await apiClient.post<{ ok: boolean }>("/auth/logout")
  return data
}

export const startMagicLink = async (email: string) => {
  const { data } = await apiClient.post<{ ok: boolean }>("/auth/magic-link/start", {
    email
  })
  return data
}

export const consumeMagicLink = async (token: string) => {
  const { data } = await apiClient.get<TokenResponse>(
    `/auth/magic-link/consume`,
    { params: { token } }
  )
  return data
}
