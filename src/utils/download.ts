import { Response } from 'express';
import { AppError } from './AppError';

export async function streamFileDownload(
  res: Response,
  url: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  const upstream = await fetch(url);

  if (!upstream.ok) {
    throw AppError.internal('Could not fetch file from storage', 'DOWNLOAD_FAILED');
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());

  const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  res.setHeader('Content-Length', String(buffer.length));

  res.send(buffer);
}