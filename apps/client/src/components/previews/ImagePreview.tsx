import React, { useEffect, useState } from 'react';
import { PreviewProps } from '@/lib/preview-factory';
import { convertAssetUrl } from '@/lib/transport';
import { PreviewSkeleton } from '@/components/ui/Skeleton';

const ImagePreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [imageError, setImageError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [imageSrc, setImageSrc] = useState<string>('');

  useEffect(() => {
    // Reset states when file changes
    setLoading(true);
    setImageError(false);

    // Convert file path to Tauri asset URL
    const assetUrl = convertAssetUrl(file.path);
    setImageSrc(assetUrl);
  }, [file.path]);

  const handleImageLoad = () => {
    setLoading(false);
    onLoad?.();
  };

  const handleImageError = () => {
    setImageError(true);
    setLoading(false);
    onError?.(new Error('Failed to load image'));
  };

  return (
    <div className="flex h-full flex-col">
      {loading && <PreviewSkeleton />}
      {!imageError && (
        <div
          className={`bg-xp-surface border-xp-border flex flex-1 items-center justify-center overflow-hidden rounded border ${loading ? 'hidden' : ''}`}
        >
          <img
            src={imageSrc}
            alt={file.name}
            className="max-h-full max-w-full object-contain"
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        </div>
      )}
      {imageError && (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <svg className="mx-auto mb-2 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview image</p>
            <p className="mt-1 text-xs opacity-70">The image format may not be supported</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(ImagePreview);
