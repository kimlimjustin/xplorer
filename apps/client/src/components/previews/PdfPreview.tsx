import React, { useState, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { PreviewProps } from '@/lib/preview-factory';
import { convertAssetUrl } from '@/lib/transport';

// Set up PDF.js worker — use the bundled mjs worker from pdfjs-dist
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

const PdfPreview = ({ file, onError, onLoad }: PreviewProps) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfSrc, setPdfSrc] = useState<string>('');

  useEffect(() => {
    // Reset states when file changes
    setLoading(true);
    setError(null);
    setPageNumber(1);
    setNumPages(0);

    // Convert file path to Tauri asset URL
    const assetUrl = convertAssetUrl(file.path);
    setPdfSrc(assetUrl);
  }, [file.path]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
    onLoad?.();
  };

  const onDocumentLoadError = (error: Error) => {
    setError(error.message);
    setLoading(false);
    onError?.(error);
  };

  const goToPrevPage = () => {
    setPageNumber((prev) => Math.max(1, prev - 1));
  };

  const goToNextPage = () => {
    setPageNumber((prev) => Math.min(numPages, prev + 1));
  };

  return (
    <div className="flex h-full flex-col">
      {loading && (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <div className="animate-pulse">
              <div className="bg-xp-bg mx-auto mb-2 h-20 w-16 rounded" />
              <p className="text-xs">Loading PDF...</p>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center rounded border">
          <div className="text-xp-text-muted text-center">
            <svg className="mx-auto mb-2 h-12 w-12" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview PDF</p>
            <p className="mt-1 text-xs opacity-70">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="bg-xp-surface border-xp-border flex flex-1 items-center justify-center overflow-hidden rounded border">
            <Document
              file={pdfSrc}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              loading={null}
            >
              <Page
                pageNumber={pageNumber}
                width={Math.min(400, window.innerWidth - 100)}
                loading={null}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
          </div>

          {numPages > 0 && (
            <div className="bg-xp-bg border-xp-border mt-2 flex items-center justify-between rounded border px-2 py-1 text-xs">
              <button
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="bg-xp-surface border-xp-border hover:bg-xp-surface-light rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>

              <span className="text-xp-text-muted">
                Page {pageNumber} of {numPages}
              </span>

              <button
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="bg-xp-surface border-xp-border hover:bg-xp-surface-light rounded border px-2 py-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default React.memo(PdfPreview);
