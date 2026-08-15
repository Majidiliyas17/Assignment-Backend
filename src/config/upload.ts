import { env } from './env';

const DEFAULT_ALLOWED_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'txt',
  'csv',
  'zip',
  'mp4',
];

export const ALLOWED_EXTENSIONS: string[] = env.ALLOWED_EXTENSIONS
  ? env.ALLOWED_EXTENSIONS.split(',').map((ext) => ext.trim().toLowerCase()).filter(Boolean)
  : DEFAULT_ALLOWED_EXTENSIONS;

export const DANGEROUS_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'sh',
  'php',
  'jsp',
  'asp',
  'aspx',
  'msi',
  'scr',
  'jar',
  'vbs',
  'ps1',
  'wsf',
  'cgi',
  'pl',
  'py',
  'html',
  'htm',
  'svg',
  'js',
  'mjs',
];

const EXTENSION_TO_MIME: Record<string, string[]> = {
  jpg: ['image/jpeg'],
  jpeg: ['image/jpeg'],
  png: ['image/png'],
  webp: ['image/webp'],
  pdf: ['application/pdf'],
  doc: ['application/msword'],
  docx: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  xls: ['application/vnd.ms-excel'],
  xlsx: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  ppt: ['application/vnd.ms-powerpoint'],
  pptx: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  txt: ['text/plain'],
  csv: ['text/csv'],
  zip: ['application/zip', 'application/x-zip-compressed'],
  mp4: ['video/mp4'],
};

export function getAllowedMimeTypes(extension: string): string[] {
  return EXTENSION_TO_MIME[extension] ?? [];
}