import { toPng } from "html-to-image";

import type { WrappedData } from "./types";

/**
 * Generate share image using proper html-to-image approach with refs
 */
export async function generateShareImageFromElement(
  element: HTMLElement,
): Promise<Blob | null> {
  try {
    const dataUrl = await toPng(element, {
      cacheBust: true,
      backgroundColor: "#ffffff",
      width: 1080,
      height: 1920,
      canvasWidth: 1080,
      canvasHeight: 1920,
    });

    const response = await fetch(dataUrl);
    const blob = await response.blob();

    return blob;
  } catch (error) {
    console.error("❌ Failed to capture image:", error);
    return null;
  }
}

/**
 * Opens a preview window with the generated image
 */
export function openImagePreview(
  imageBlob: Blob,
  data: WrappedData,
): Window | null {
  const url = URL.createObjectURL(imageBlob);
  const previewWindow = window.open(
    "",
    "_blank",
    "width=1080,height=1920,scrollbars=yes,resizable=yes",
  );

  if (previewWindow) {
    previewWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${data.festival_info.name} Wrapped Preview</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              background: #f3f4f6;
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: flex-start;
              min-height: 100vh;
            }
            .container {
              background: white;
              border-radius: 8px;
              padding: 20px;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
              text-align: center;
            }
            img {
              max-width: 100%;
              height: auto;
              border-radius: 8px;
              margin-bottom: 20px;
            }
            .info {
              color: #6b7280;
              font-size: 14px;
              margin-bottom: 20px;
            }
            .actions {
              display: flex;
              gap: 10px;
              justify-content: center;
              flex-wrap: wrap;
            }
            button {
              padding: 8px 16px;
              border: none;
              border-radius: 6px;
              cursor: pointer;
              font-size: 14px;
              transition: all 0.2s;
            }
            .download-btn {
              background: #f59e0b;
              color: white;
            }
            .download-btn:hover {
              background: #d97706;
            }
            .close-btn {
              background: #ef4444;
              color: white;
            }
            .close-btn:hover {
              background: #dc2626;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <img src="${url}" alt="${data.festival_info.name} Wrapped" />
            <div class="info">
              <p><strong>${data.festival_info.name} Wrapped</strong></p>
              <p>Perfect for Instagram Stories • 1080×1920</p>
            </div>
            <div class="actions">
              <button class="download-btn" onclick="
                const link = document.createElement('a');
                link.href = '${url}';
                link.download = '${data.festival_info.name}-wrapped.png';
                link.click();
                alert('Image downloaded!');
              ">Download</button>
              <button class="close-btn" onclick="window.close()">Close Preview</button>
            </div>
          </div>
        </body>
      </html>
    `);
    previewWindow.document.close();
  }

  // Clean up the URL after a delay to allow the window to load it
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 100);

  return previewWindow;
}
