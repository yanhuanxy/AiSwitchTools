import { apiClient } from "./api"
import type { Character, CharacterVersion } from "../types"

export const fetchRoles = async () => {
  const { data } = await apiClient.get<Character[]>("/characters")
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
