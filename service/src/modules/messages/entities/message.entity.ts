export interface MessageEntity {
  id: string;
  role: string;
  content: string;
  status: string;
  partial: boolean;
  supersededByMessageId: string | null;
  attachments: Array<{
    attachmentId: string;
    scanStatus: string;
    viewUrl: string | null;
    mime: string;
    size: number;
    width?: number;
    height?: number;
  }>;
  createdAt: string;
}
