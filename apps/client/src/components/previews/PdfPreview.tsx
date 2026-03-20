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
    <div className="h-full flex flex-col">
      {loading && (
        <div className="flex-1 flex items-center justify-center bg-xp-surface border border-xp-border rounded">
          <div className="text-center text-xp-text-muted">
            <div className="animate-pulse">
              <div className="w-16 h-20 bg-xp-bg rounded mb-2 mx-auto"></div>
              <p className="text-xs">Loading PDF...</p>
            </div>
          </div>
        </div>
      )}

      {error ? (
        <div className="flex-1 flex items-center justify-center bg-xp-surface border border-xp-border rounded">
          <div className="text-center text-xp-text-muted">
            <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm">Cannot preview PDF</p>
            <p className="text-xs mt-1 opacity-70">{error}</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-xp-surface border border-xp-border rounded overflow-hidden">
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
            <div className="flex items-center justify-between mt-2 px-2 py-1 bg-xp-bg border border-xp-border rounded text-xs">
              <button
                onClick={goToPrevPage}
                disabled={pageNumber <= 1}
                className="px-2 py-1 bg-xp-surface border border-xp-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-xp-surface-light"
              >
                Previous
              </button>

              <span className="text-xp-text-muted">
                Page {pageNumber} of {numPages}
              </span>

              <button
                onClick={goToNextPage}
                disabled={pageNumber >= numPages}
                className="px-2 py-1 bg-xp-surface border border-xp-border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-xp-surface-light"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default React.memo(PdfPreview);
