import { apiClient } from "./api"
import type { Character, CharacterVersion } from "../types"

export const fetchRoles = async (query?: { search?: string; favorites?: boolean }) => {
  const params = new URLSearchParams()
  if (query?.search) params.append("search", query.search)
  if (query?.favorites) params.append("favorites", "true")
  const { data } = await apiClient.get<Character[]>(`/characters?${params.toString()}`)
  return data
}

export const toggleRoleFavorite = async (roleId: string) => {
  const { data } = await apiClient.post<{ isFavorite: boolean }>(
    `/characters/${roleId}/favorite`
  )
  return data
}

export const fetchRoleDetail = async (id: string) => {
  const { data } = await apiClient.get<Character>(`/characters/${id}`)
  return data
}

export const fetchRoleVersions = async (id: string) => {
  const { data } = await apiClient.get<CharacterVersion[]>(
    `/characters/${id}/versions`
  )
  return data
}

export const createRole = async (payload: {
  name: string
  bio?: string
  avatarAttachmentId?: string
}) => {
  const { data } = await apiClient.post<{ id: string }>("/characters", payload)
  return data
}

export const createRoleVersion = async (
  roleId: string,
  payload: {
    status: "draft" | "published"
    promptConfig: CharacterVersion["promptConfig"]
  }
) => {
  const { data } = await apiClient.post<{ versionId: string; version: number }>(
    `/characters/${roleId}/versions`,
    payload
  )
  return data
}

export const updateRoleVersion = async (
  versionId: string,
  payload: { promptConfig: CharacterVersion["promptConfig"] }
) => {
  const { data } = await apiClient.put<{ versionId: string }>(
    `/character-versions/${versionId}`,
    payload
  )
  return data
}

export const publishRoleVersion = async (versionId: string) => {
  const { data } = await apiClient.post<{ versionId: string; version: number }>(
    `/character-versions/${versionId}/publish`
  )
  return data
}
