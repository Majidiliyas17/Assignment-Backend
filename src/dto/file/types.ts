import { CloudinaryResourceType, FileStatus, FileVisibility } from '../../enums';

export interface FileView {
  id: string;
  originalName: string;
  mimeType: string;
  extension: string;
  size: number;
  visibility: FileVisibility;
  status: FileStatus;
  resourceType: CloudinaryResourceType;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedFiles {
  files: FileView[];
  pagination: PaginationMeta;
}

export interface ShareResult {
  file: FileView;
  shareToken: string;
  shareUrl: string;
}

export interface PublicShareResult {
  file: FileView;
  downloadUrl: string;
}
