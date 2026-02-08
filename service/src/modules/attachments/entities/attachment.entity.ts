export type AttachmentType = string;
export type AttachmentScanStatus = string;

export interface AttachmentEntity {
  id: string;
  ownerUserId: string;
  type: AttachmentType;
  storageKey: string;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
  scanStatus: AttachmentScanStatus;
  createdAt: Date;
  metadata?: Record<string, any>;
}
