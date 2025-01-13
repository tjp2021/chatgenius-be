export interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FileUploadResponse {
  id: string;
  name: string;
  url: string;
} 