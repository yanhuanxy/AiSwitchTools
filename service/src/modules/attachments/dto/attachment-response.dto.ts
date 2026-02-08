import type { AttachmentScanStatus } from '../entities';

export class AttachmentResponseDto {
  attachmentId!: string;
  scanStatus!: AttachmentScanStatus;
  viewUrl!: string | null;
  mime?: string;
  size?: number;
  width?: number | null;
  height?: number | null;
  createdAt?: Date;
  traceId?: string;
}

export class AttachmentListResponseDto {
  items!: AttachmentResponseDto[];
  nextCursor?: string;
  traceId?: string;
}
