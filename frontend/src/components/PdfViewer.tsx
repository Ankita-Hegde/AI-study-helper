import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';

// Use the packaged worker via import.meta.url so Vite can resolve it correctly
(pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.js', import.meta.url).toString();

export interface Highlight {
  pageIndex: number; // 0-based
  rects: Array<{ left: number; top: number; width: number; height: number }>; // in pixels relative to page viewport
  color?: string;
}

export interface PdfViewerHandle {
  findAndHighlight: (phrases: string[]) => Promise<Highlight[]>;
}

const PdfViewer = forwardRef<PdfViewerHandle, { url: string, className?: string, scale?: number }>(function PdfViewer({ url, className, scale = 1.5 }, ref) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pdf, setPdf] = useState<any>(null);
  const pageViewports = useRef<any[]>([]);
  const textContents = useRef<Array<string>>([]);
  const pageItems = useRef<Array<Array<{ str: string }>>>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument(url);
        const pdfDoc = await loadingTask.promise;
        if (cancelled) return;
        setPdf(pdfDoc);
      } catch (e) {
        console.error('Failed to load pdf', e);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [url]);

  useEffect(() => {
    if (!pdf || !containerRef.current) return;
    const container = containerRef.current;
    // clear container
    container.innerHTML = '';
    pageViewports.current = [];
    textContents.current = [];
    pageItems.current = [];
    let cancelled = false;
    const render = async () => {
      for (let i = 1; i <= pdf.numPages; i++) {
        if (cancelled) return;
        const page = await pdf.getPage(i);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        pageViewports.current.push(viewport);

        // create page container
        const pageDiv = document.createElement('div');
        pageDiv.className = 'pdf-page relative mb-6 bg-white';
        pageDiv.style.width = `${Math.round(viewport.width)}px`;
        pageDiv.style.height = `${Math.round(viewport.height)}px`;
        // center pages and avoid horizontal overflow
        pageDiv.style.margin = '0 auto';

        // canvas - render at devicePixelRatio for better clarity on high-DPI screens
        const canvas = document.createElement('canvas');
        const outputScale = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
        canvas.width = Math.round(viewport.width * outputScale);
        canvas.height = Math.round(viewport.height * outputScale);
        // set CSS size to the viewport size (unscaled)
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;
        pageDiv.appendChild(canvas);
        // Append the page container early so the UI remains stable even if rendering fails
        container.appendChild(pageDiv);
        const ctx = canvas.getContext('2d');
        try {
          if (ctx && outputScale !== 1) {
            ctx.setTransform(outputScale, 0, 0, outputScale, 0, 0);
          }
          // render may fail for large PDFs or resource issues; catch and continue
          await page.render({ canvasContext: ctx!, viewport }).promise;
        } catch (renderErr) {
          console.warn('PDF page render failed for page', i, renderErr);
        }

        // get text content and store as plain page text (no DOM text-layer)
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((it: any) => (it.str || '')).join(' ');
        pageItems.current.push(textContent.items.map((it: any) => ({ str: it.str || '' })));
        textContents.current.push(pageText.trim());
      }
    };
    render().catch(e => console.error(e));
    return () => { cancelled = true; };
  }, [pdf, scale]);

  useImperativeHandle(ref, () => ({
    findAndHighlight: async (_phrases: string[]) => {
      // highlighting removed; keep API but return empty result
      return [] as Highlight[];
    }
  }));

  return (
    <div className={className || ''} style={{ overflowY: 'auto', padding: 12 }}>
      <div ref={containerRef} />
    </div>
  );
});

export default PdfViewer;
