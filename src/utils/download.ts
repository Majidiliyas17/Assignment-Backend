import { Response } from 'express';
import { Readable } from 'stream';
import { AppError } from './AppError';

export async function streamFileDownload(
  res: Response,
  url: string,
  filename: string,
  mimeType: string,
): Promise<void> {
  let upstream: Awaited<ReturnType<typeof fetch>>;

  try {
    upstream = await fetch(url);
  } catch {
    throw AppError.internal('Could not reach the file storage. Please try again later.', 'DOWNLOAD_FAILED');
  }

  if (!upstream.ok) {
    throw AppError.badGateway(
      `The file storage returned an error (${upstream.status}). Please try again later.`,
      'DOWNLOAD_FAILED',
      { status: upstream.status },
    );
  }

  const safeAscii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
  res.setHeader('Content-Type', mimeType || 'application/octet-stream');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${safeAscii}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
  );
  if (upstream.headers.get('content-length')) {
    res.setHeader('Content-Length', upstream.headers.get('content-length')!);
  }

  await new Promise<void>((resolve, reject) => {
    const body = upstream.body;
    if (!body) {
      reject(new Error('Empty upstream response body'));
      return;
    }

    const nodeStream = Readable.fromWeb(body);

    nodeStream.on('error', (error) => reject(error));
    res.on('finish', resolve);
    res.on('close', () => {
      nodeStream.destroy();
      resolve();
    });

    nodeStream.pipe(res);
  });
}