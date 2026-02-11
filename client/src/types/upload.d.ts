export interface UploadResponse {
  url: string
  width: number
  height: number
  size: number
}

export interface UploadFile {
  id: string
  file?: File
  url?: string
  status: "pending" | "uploading" | "success" | "error"
  progress: number
  width?: number
  height?: number
  size?: number
  error?: Error
}
