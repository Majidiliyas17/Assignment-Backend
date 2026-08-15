import type { SignedUploadParams } from '../../src/dto/cloudinary';

export async function directUpload(
  params: SignedUploadParams,
  content: Buffer,
): Promise<{ public_id: string; bytes: number }> {
  const url = `https://api.cloudinary.com/v1_1/${params.cloudName}/${params.resourceType}/upload`;
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/plain' }), 'hello.txt');
  form.append('public_id', params.publicId);
  form.append('timestamp', params.timestamp);
  form.append('api_key', params.apiKey);
  form.append('signature', params.signature);
  form.append('resource_type', params.resourceType);

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed (${res.status}): ${await res.text()}`);
  }
  return (await res.json()) as { public_id: string; bytes: number };
}