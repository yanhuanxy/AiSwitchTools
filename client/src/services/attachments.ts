import axios from "axios"
import { apiClient } from "./api"
import type { Attachment } from "../types"

type UploadItem = {
  attachmentId: string
  scanStatus?: string
  uploadUrl?: string
  viewUrl?: string
}

const uploadMode =
  import.meta.env.VITE_UPLOAD_MODE || import.meta.env.VITE_UPLOAD_STRATEGY || "relay"

const normalizeUploadResponse = (data: UploadItem[] | UploadItem) =>
  Array.isArray(data) ? data : [data]

const initUpload = async (selected: File[]) => {
  const form = new FormData()
  selected.forEach((file) => form.append("files", file))
  const { data } = await apiClient.post<UploadItem[] | UploadItem>("/uploads/images", form, {
    headers: { "Content-Type": "multipart/form-data" }
  })
  return normalizeUploadResponse(data)
}

const shouldRetryUpload = (error: any) => {
  const status = error?.response?.status
  if (!status) return true
  return [400, 403, 408, 409, 410, 425, 429].includes(status)
}

const putFile = async (uploadUrl: string, file: File) => {
  await axios.put(uploadUrl, file, {
    headers: { "Content-Type": file.type || "application/octet-stream" }
  })
}

const uploadDirectItem = async (file: File, item: UploadItem) => {
  let current = item
  if (!current.uploadUrl || !current.attachmentId) {
    const [fresh] = await initUpload([file])
    if (!fresh) {
      throw new Error("UPLOAD_FAILED")
    }
    current = fresh
  }
  try {
    if (current.uploadUrl) {
      await putFile(current.uploadUrl, file)
    }
  } catch (error: any) {
    if (!shouldRetryUpload(error)) {
      throw error
    }
    const [fresh] = await initUpload([file])
    if (!fresh) {
      throw new Error("UPLOAD_FAILED")
    }
    current = fresh
    if (current.uploadUrl) {
      await putFile(current.uploadUrl, file)
    }
  }
  return fetchAttachment(current.attachmentId)
}

const runWithLimit = async <T>(tasks: Array<() => Promise<T>>, limit: number) => {
  const results: T[] = []
  let index = 0
  const workers = Array.from({ length: Math.min(limit, tasks.length) }).map(async () => {
    while (index < tasks.length) {
      const current = index
      index += 1
      results[current] = await tasks[current]()
    }
  })
  await Promise.all(workers)
  return results
}

export const uploadImages = async (files: File[]) => {
  const items = await initUpload(files)
  if (uploadMode !== "direct") {
    return items as Attachment[]
  }
  const tasks = files.map((file, index) => {
    const item = items[index] || { attachmentId: "", scanStatus: "pending" }
    return () => uploadDirectItem(file, item)
  })
  return runWithLimit(tasks, 3)
}

export const fetchAttachment = async (attachmentId: string) => {
  const { data } = await apiClient.get<Attachment>(`/attachments/${attachmentId}`)
  return data
}

export const deleteAttachment = async (attachmentId: string) => {
  const { data } = await apiClient.delete(`/attachments/${attachmentId}`)
  return data
}
