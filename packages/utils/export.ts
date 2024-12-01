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
import { GetColorName } from 'hex-color-to-color-name';

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
  backgroundColor?: string;
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
  backgroundColor?: string;
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


//get color for anotation from hexcode
const getColorName = (hex: string) => {
  const validHex = hex || "#FFFFFF";
  const colorName = GetColorName(validHex);
  return colorName ? colorName : "Unknown Color";
};

// Generate annotations function

function generateAnnotations(elements: Element[]): Annotation[] {
  // Initialize an empty array to hold the annotations
  const annotations: Annotation[] = [];

  // Iterate over the elements to generate the necessary annotations
  elements.forEach((element) => {
    const annotation: Annotation = { 
      type: "", 
      x: element.x, 
      y: element.y,
      backgroundColor: element.backgroundColor || "transparent",
      strokeColor: element.strokeColor || "#000000"
    };

    // Handle different types of elements (Circle, Rectangle, etc.)
    switch (element.type) {
      case "ellipse":
        annotation.type = "circle";
        annotation.radius = (element.width || 0) / 2;
        annotation.text = "It has a circle";
        break;

      case "rectangle":
        annotation.type = "rectangle";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "It has a rectangle";
        break;

      case "square":
        annotation.type = "square";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "It has a square";
        break;

      case "diamond":
        annotation.type = "diamond";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "It has a diamond";
        break;

      case "rhombus":
        annotation.type = "rhombus";
        annotation.width = element.width;
        annotation.height = element.height;
        annotation.text = "It has a rhombus";
        break;

      case "line":
        annotation.type = "line";
        annotation.width = element.width;
        annotation.text = "It has a line";
        break;

      case "arrow":
        annotation.type = "arrow";
        annotation.width = element.width;
        annotation.text = "It has an arrow";
        break;

      case "freedraw":
        annotation.type = "freedraw";
        annotation.text = "It has a freehand drawing";
        break;

      default:
        console.warn(`Unknown element type: ${element.type}`);
        break;
    }

    annotations.push(annotation); 
  });
  
  return annotations;
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

    // Convert the canvas to a PNG image
    const imgData = canvas.toDataURL("image/png");

    // create pdf
    const pdf = new jsPDF();
    pdf.addImage(imgData, "PNG", 10, 10, 190, 0);

    // annotations if true
    if (appState.exportWithAnnotations) {
      // Generate annotations
      const annotations = generateAnnotations(elements);

      // add annotations at the end of the PDF
      pdf.addPage();
      pdf.setFont("times", "normal");
      pdf.setFontSize(12);

      // add a annotation heading
      pdf.text("Annotations", 10, 20);

      // Iterate through annotations and add them as a list
      annotations.forEach((annotation, index) => {
        const annotationText = annotation.text || "Not Sure";
        const backgroundColorName = getColorName(annotation?.backgroundColor ?? "#FFFFFF"); 
        const borderColorName = getColorName(annotation?.strokeColor ?? "#FFFFFF"); 
        const annotationInfo = `${index + 1}. ${annotationText} with the background color of ${backgroundColorName} and border color of ${borderColorName}`;
        pdf.text(annotationInfo, 10, 30 + index * 10);
      });
    }

    // save pdf
    pdf.save(`${projectName}.pdf`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
  }
};
