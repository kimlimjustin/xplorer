import { put } from '@vercel/blob';

/**
 * Upload an extension ZIP file to Vercel Blob storage.
 *
 * All blobs are stored as public (Vercel Blob limitation). Access control for
 * paid extensions is enforced at the download API route, which verifies purchase
 * status before returning the download URL. The raw blob URL uses a random token
 * path that is not discoverable without the database record.
 */
export async function uploadExtensionFile(
  file: File,
  extensionId: string,
  version: string,
  slug: string,
  _isPaid: boolean = false,
): Promise<{ url: string; downloadUrl: string }> {
  const pathname = `extensions/${extensionId}/${version}/${slug}-${version}.zip`;

  const blob = await put(pathname, file, {
    access: 'public',
    addRandomSuffix: true,
  });

  return {
    url: blob.url,
    downloadUrl: blob.downloadUrl,
  };
}

/**
 * Compute a SHA-256 checksum of a buffer using Web Crypto API.
 */
export async function computeChecksum(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}
