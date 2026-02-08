import { defineStore } from "pinia"
import { consumeMagicLink, requestAnonToken, refreshToken, logout as apiLogout } from "../services/auth"

type TokenState = {
  accessToken: string | null
  refreshToken: string | null
  expiresAt: number | null
  identityType: string | null
  userId: string | null
  tokenVersion: number | null
}

const storageKey = "ai-switch-tools-auth"
let refreshPromise: Promise<void> | null = null

const readStorage = (): TokenState | null => {
  const raw = localStorage.getItem(storageKey)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TokenState
  } catch {
    return null
  }
}

const writeStorage = (state: TokenState) => {
  localStorage.setItem(storageKey, JSON.stringify(state))
}

const clearStorage = () => {
  localStorage.removeItem(storageKey)
}

export const useAuthStore = defineStore("auth", {
  state: (): TokenState => ({
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    identityType: null,
    userId: null,
    tokenVersion: null
  }),
  actions: {
    hydrate() {
      const data = readStorage()
      if (data) {
        this.$patch(data)
      }
    },
    persist() {
      writeStorage({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        expiresAt: this.expiresAt,
        identityType: this.identityType,
        userId: this.userId,
        tokenVersion: this.tokenVersion
      })
    },
    clearAuth() {
      this.$patch({
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        identityType: null,
        userId: null,
        tokenVersion: null
      })
      clearStorage()
    },
    async ensureAuthReady() {
      this.hydrate()
      if (!this.accessToken) {
        await this.loginAsAnon()
        return
      }
      if (this.expiresAt && Date.now() > this.expiresAt) {
        await this.refreshAccessToken()
      }
    },
    async loginAsAnon() {
      const data = await requestAnonToken()
      this.applyTokenResponse(data)
    },
    async refreshAccessToken() {
      if (!this.refreshToken) {
        await this.loginAsAnon()
        return
      }
      if (!refreshPromise) {
        refreshPromise = refreshToken(this.refreshToken)
          .then((data) => {
            this.applyTokenResponse(data)
          })
          .finally(() => {
            refreshPromise = null
          })
      }
      await refreshPromise
    },
    async logout() {
      try {
        if (this.accessToken) {
          await apiLogout()
        }
      } catch (error) {
        console.warn("Logout failed:", error)
      } finally {
        this.clearAuth()
        await this.loginAsAnon()
      }
    },
    async handleAuthRequired() {
      this.clearAuth()
      await this.loginAsAnon()
    },
    async bindWithMagicToken(token: string) {
      const data = await consumeMagicLink(token)
      this.applyTokenResponse(data)
    },
    applyTokenResponse(data: {
      accessToken: string
      refreshToken: string
      expiresIn: number
      identityType?: string
      userId?: string
      tokenVersion?: number
    }) {
      this.accessToken = data.accessToken
      this.refreshToken = data.refreshToken
      this.expiresAt = Date.now() + data.expiresIn * 1000
      if (data.identityType !== undefined) {
        this.identityType = data.identityType
      }
      if (data.userId !== undefined) {
        this.userId = data.userId
      }
      if (data.tokenVersion !== undefined) {
        this.tokenVersion = data.tokenVersion
      }
      this.persist()
    }
  }
})
