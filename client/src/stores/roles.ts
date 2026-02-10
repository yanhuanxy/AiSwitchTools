import { defineStore } from "pinia"
import type { Character, CharacterVersion } from "../types"
import {
  createRole,
  createRoleVersion,
  fetchRoleDetail,
  fetchRoleVersions,
  fetchRoles,
  publishRoleVersion,
  updateRoleVersion,
  toggleRoleFavorite
} from "../services/roles"

export const useRoleStore = defineStore("roles", {
  state: () => ({
    roles: [] as Character[],
    activeRole: null as Character | null,
    activeVersions: [] as CharacterVersion[]
  }),
  actions: {
    async loadRoles(query?: { search?: string; favorites?: boolean }) {
      const response = await fetchRoles(query)
      const list = Array.isArray(response) ? response : (response as any)?.items || []
      this.roles = list.filter((item: any) => item && item.id)
    },
    async toggleFavorite(roleId: string) {
      const { isFavorite } = await toggleRoleFavorite(roleId)
      // Update local state
      const role = this.roles.find((r) => r.id === roleId)
      if (role) {
        role.isFavorite = isFavorite
        // If viewing favorites, remove it from list if unfavorited
        // Note: We might need to pass current view context, but simplest is to just update prop
      }
      return isFavorite
    },
    async loadRoleDetail(id: string) {
      this.activeRole = await fetchRoleDetail(id)
      const response = await fetchRoleVersions(id)
      const list = Array.isArray(response) ? response : (response as any)?.items || []
      this.activeVersions = list.filter((v: any) => v && v.version)
    },
    async createRole(payload: { name: string; bio?: string; avatarAttachmentId?: string }) {
      return createRole(payload)
    },
    async createVersion(roleId: string, payload: { status: "draft" | "published"; promptConfig: CharacterVersion["promptConfig"] }) {
      return createRoleVersion(roleId, payload)
    },
    async updateVersion(versionId: string, payload: { promptConfig: CharacterVersion["promptConfig"] }) {
      return updateRoleVersion(versionId, payload)
    },
    async publishVersion(versionId: string) {
      return publishRoleVersion(versionId)
    }
  }
})
