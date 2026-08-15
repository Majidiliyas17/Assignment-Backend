import { CloudinaryResourceType } from '../../enums';

export interface SignedUploadParams {
  signature: string;
  timestamp: string;
  apiKey: string;
  cloudName: string;
  folder: string;
  publicId: string;
  resourceType: CloudinaryResourceType;
}

export interface CloudinaryAssetInfo {
  publicId: string;
  size: number;
  resourceType: string;
  format: string;
  createdAt?: string;
}
