import {
  exportToCanvas as _exportToCanvas,
  exportToSvg as _exportToSvg,
} from "../excalidraw/scene/export";
import { getDefaultAppState } from "../excalidraw/appState";
import type { AppState, BinaryFiles } from "../excalidraw/types";
import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
} from "../excalidraw/element/types";
import { restore } from "../excalidraw/data/restore";
import { MIME_TYPES } from "../excalidraw/constants";
import { encodePngMetadata } from "../excalidraw/data/image";
import { serializeAsJSON } from "../excalidraw/data/json";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../excalidraw/clipboard";
import { jsPDF } from "jspdf";

export { MIME_TYPES };

type ExportOpts = {
  elements: readonly NonDeleted<ExcalidrawElement>[];
  appState?: Partial<Omit<AppState, "offsetTop" | "offsetLeft">>;
  files: BinaryFiles | null;
  maxWidthOrHeight?: number;
  exportingFrame?: ExcalidrawFrameLikeElement | null;
  getDimensions?: (
    width: number,
    height: number,
  ) => { width: number; height: number; scale?: number };
};
interface Element {
  type: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface Annotation {
  type: string;
  x: number;
  y: number;
  radius?: number;
  width?: number;
  height?: number;
  strokeColor?: string;
  strokeWidth?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  color?: string;
}
export const exportToCanvas = ({
  elements,
  appState,
  files,
  maxWidthOrHeight,
  getDimensions,
  exportPadding,
  exportingFrame,
}: ExportOpts & {
  exportPadding?: number;
}) => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { elements, appState },
    null,
    null,
  );
  const { exportBackground, viewBackgroundColor } = restoredAppState;
  return _exportToCanvas(
    restoredElements,
    { ...restoredAppState, offsetTop: 0, offsetLeft: 0, width: 0, height: 0 },
    files || {},
    { exportBackground, exportPadding, viewBackgroundColor, exportingFrame },
    (width: number, height: number) => {
      const canvas = document.createElement("canvas");

      if (maxWidthOrHeight) {
        if (typeof getDimensions === "function") {
          console.warn(
            "`getDimensions()` is ignored when `maxWidthOrHeight` is supplied.",
          );
        }

        const max = Math.max(width, height);

        // if content is less then maxWidthOrHeight, fallback on supplied scale
        const scale =
          maxWidthOrHeight < max
            ? maxWidthOrHeight / max
            : appState?.exportScale ?? 1;

        canvas.width = width * scale;
        canvas.height = height * scale;

        return {
          canvas,
          scale,
        };
      }

      const ret = getDimensions?.(width, height) || { width, height };

      canvas.width = ret.width;
      canvas.height = ret.height;

      return {
        canvas,
        scale: ret.scale ?? 1,
      };
    },
  );
};

export const exportToBlob = async (
  opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
    exportPadding?: number;
  },
): Promise<Blob> => {
  let { mimeType = MIME_TYPES.png, quality } = opts;

  if (mimeType === MIME_TYPES.png && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "${MIME_TYPES.png}" mimeType`);
  }

  // typo in MIME type (should be "jpeg")
  if (mimeType === "image/jpg") {
    mimeType = MIME_TYPES.jpg;
  }

  if (mimeType === MIME_TYPES.jpg && !opts.appState?.exportBackground) {
    console.warn(
      `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
    );
    opts = {
      ...opts,
      appState: { ...opts.appState, exportBackground: true },
    };
  }

  const canvas = await exportToCanvas(opts);

  quality = quality ? quality : /image\/jpe?g/.test(mimeType) ? 0.92 : 0.8;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          return reject(new Error("couldn't export to blob"));
        }
        if (
          blob &&
          mimeType === MIME_TYPES.png &&
          opts.appState?.exportEmbedScene
        ) {
          blob = await encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              // NOTE as long as we're using the Scene hack, we need to ensure
              // we pass the original, uncloned elements when serializing
              // so that we keep ids stable
              opts.elements,
              opts.appState,
              opts.files || {},
              "local",
            ),
          });
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

export const exportToSvg = async ({
  elements,
  appState = getDefaultAppState(),
  files = {},
  exportPadding,
  renderEmbeddables,
  exportingFrame,
  skipInliningFonts,
  reuseImages,
}: Omit<ExportOpts, "getDimensions"> & {
  exportPadding?: number;
  renderEmbeddables?: boolean;
  skipInliningFonts?: true;
  reuseImages?: boolean;
}): Promise<SVGSVGElement> => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { elements, appState },
    null,
    null,
  );

  const exportAppState = {
    ...restoredAppState,
    exportPadding,
  };

  return _exportToSvg(restoredElements, exportAppState, files, {
    exportingFrame,
    renderEmbeddables,
    skipInliningFonts,
    reuseImages,
  });
};

export const exportToClipboard = async (
  opts: ExportOpts & {
    mimeType?: string;
    quality?: number;
    type: "png" | "svg" | "json";
  },
) => {
  if (opts.type === "svg") {
    const svg = await exportToSvg(opts);
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (opts.type === "png") {
    await copyBlobToClipboardAsPng(exportToBlob(opts));
  } else if (opts.type === "json") {
    await copyToClipboard(opts.elements, opts.files);
  } else {
    throw new Error("Invalid export type");
  }
};



// Generate annotations function

function generateAnnotations(elements: Element[]): Annotation[] {
  // Initialize an empty array to hold the annotations
  const annotations: Annotation[] = [];

  // Iterate over the elements to generate the necessary annotations
  elements.forEach((element) => {
    const annotation: Annotation = { type: "", x: element.x, y: element.y };

    // Handle different types of elements (Circle, Rectangle, etc.)
    switch (element.type) {
      case "ellipse":
        annotation.type = "circle"; // Represent as a circle
        annotation.radius = (element.width || 0) / 2; // Assuming width = height for circle
        annotation.text = "This is a circle"; // Adding text description for the circle
        break;

      case "rectangle":
        annotation.type = "rectangle";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "This is a rectangle"; // Adding text description for the rectangle
        break;

      case "square":
        annotation.type = "square";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "This is a square"; // Adding text description for the square
        break;

      case "diamond":
        annotation.type = "diamond";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "This is a diamond"; // Adding text description for the rhombus
        break;
        
      case "rhombus":
        annotation.type = "rhombus";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "This is a rhombus"; // Adding text description for the rhombus
        break;

      default:
        // Handle other cases or unknown element types
        console.warn(`Unknown element type: ${element.type}`);
        break;
    }

    annotations.push(annotation); // Push each annotation to the array
  });
console.log(annotations)
  return annotations; // Return the array of annotations
}

// Export to PDF function
export const exportToPdf = async ({
  elements,
  appState,
  files,
  projectName = "export",
}: {
  elements: any;
  appState: any;
  files: any;
  projectName?: string;
}) => {
  try {
    // Render whiteboard content into a canvas
    const canvas = await exportToCanvas({
      elements,
      appState,
      files,
    });

    console.log("canvas", appState);
    // Convert the canvas to a PNG image
    const imgData = canvas.toDataURL("image/png");

    // Create a new PDF document
    const pdf = new jsPDF();

    // Add the whiteboard image to the PDF
    pdf.addImage(imgData, "PNG", 10, 10, 190, 0);

    // Generate annotations
    const annotations = generateAnnotations(elements);

    // Scaling logic
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const pdfWidth = 190; // PDF width for the image
    let pdfHeight = 150;  // Starting height of the PDF (adjust as needed)

    // Calculate PDF height based on canvas height to maintain proportionality
    const scaleX = pdfWidth / canvasWidth;
    const scaleY = pdfHeight / canvasHeight;

    // Adjust the PDF height based on the content if needed
    pdfHeight = canvasHeight * scaleY + 30;  // Adding extra space for annotations

    // Iterate through annotations and add them to the PDF
    annotations.forEach((annotation) => {
      const annotationX = annotation.x ?? 0; // Default to 0 if undefined
      const annotationY = annotation.y ?? 0; // Default to 0 if undefined
      const annotationWidth = annotation.width ?? 10; // Default width
      const annotationHeight = annotation.height ?? 10; // Default height
      const annotationText = annotation.text ?? "No text provided"; // Default text

      // Scale the annotation positions and sizes based on canvas size
      const annotationXScaled = annotationX * scaleX;
      const annotationYScaled = annotationY * scaleY;
      const annotationWidthScaled = annotationWidth * scaleX;
      const annotationHeightScaled = annotationHeight * scaleY;

      // Position the annotation near the object (adjust these offsets as needed)
      const annotationOffsetX = 90;  // Adjusting for text position
      const annotationOffsetY = 100;  // Adjusting for text position

      // Add the annotation text near the shape without the background
      pdf.setFont("times", "italic");
      pdf.setFontSize(10);
      if(appState.exportWithDarkMode){

        pdf.setTextColor(255, 255, 255); // Black text color
      }else{

        pdf.setTextColor(0, 0, 0); // Black text color
      }
      pdf.text(annotationText, annotationXScaled + annotationOffsetX + 2, annotationYScaled + annotationOffsetY + 7);
    });

    // Save the P D F 
    pdf.save(`${projectName}.pdf`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
  }
};






