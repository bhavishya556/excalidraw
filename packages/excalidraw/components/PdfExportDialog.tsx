import React, { useEffect, useRef, useState } from "react";
import type { ActionManager } from "../actions/manager";
import type { AppClassProperties, BinaryFiles, UIAppState } from "../types";
import {
  actionExportWithDarkMode,
  actionChangeExportBackground,

  actionChangeExportScale,
  actionChangeProjectName,
} from "../actions/actionExport";
import {
  DEFAULT_EXPORT_PADDING,
  EXPORT_SCALES
} from "../constants";

import { canvasToBlob } from "../data/blob";
import { nativeFileSystemSupported } from "../data/filesystem";
import type { NonDeletedExcalidrawElement } from "../element/types";
import { t } from "../i18n";
import { isSomeElementSelected } from "../scene";
import { exportToCanvas, exportToPdf } from "../../utils/export";

import { helpIcon } from "./icons";
import { Dialog } from "./Dialog";
import { RadioGroup } from "./RadioGroup";
import { Switch } from "./Switch";
import { Tooltip } from "./Tooltip";

import "./PdfExportDialog.scss";
import { FilledButton } from "./FilledButton";
import { cloneJSON } from "../utils";
import { prepareElementsForExport } from "../data";
import { useCopyStatus } from "../hooks/useCopiedIndicator";

const supportsContextFilters =
  "filter" in document.createElement("canvas").getContext("2d")!;

export const ErrorCanvasPreview = () => {
  return (
    <div>
      <h3>{t("canvasError.cannotShowPreview")}</h3>
      <p>
        <span>{t("canvasError.canvasTooBig")}</span>
      </p>
      <em>({t("canvasError.canvasTooBigTip")})</em>
    </div>
  );
};

type PdfExportModalProps = {
  appStateSnapshot: Readonly<UIAppState>;
  elementsSnapshot: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  name: string;
};


const PdfExportModal = ({
  appStateSnapshot,
  elementsSnapshot,
  files,
  actionManager,
  name,
}: PdfExportModalProps) => {
  const hasSelection = isSomeElementSelected(
    elementsSnapshot,
    appStateSnapshot,
  );

  const [projectName, setProjectName] = useState(name);
  const [exportSelectionOnly, setExportSelectionOnly] = useState(hasSelection);
  const [exportWithBackground, setExportWithBackground] = useState(
    appStateSnapshot.exportBackground,
  );
  const [exportDarkMode, setExportDarkMode] = useState(
    appStateSnapshot.exportWithDarkMode,
  );
  const [embedScene] = useState(appStateSnapshot.exportEmbedScene);
  const [exportScale, setExportScale] = useState(appStateSnapshot.exportScale);
  const [exportWithAnnotations, setExportWithAnnotations] = useState(false);

  const previewRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<Error | null>(null);

  const { resetCopyStatus } = useCopyStatus();

  useEffect(() => {
    // if user changes setting right after export to clipboard, reset the status
    // so they don't have to wait for the timeout to click the button again
    resetCopyStatus();
  }, [
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    embedScene,
    resetCopyStatus,
  ]);

  const { exportedElements, exportingFrame } = prepareElementsForExport(
    elementsSnapshot,
    appStateSnapshot,
    exportSelectionOnly,
  );

  useEffect(() => {
    const previewNode = previewRef.current;
    if (!previewNode) {
      return;
    }
    const maxWidth = previewNode.offsetWidth;
    const maxHeight = previewNode.offsetHeight;
    if (!maxWidth) {
      return;
    }

    exportToCanvas({
      elements: exportedElements,
      appState: {
        ...appStateSnapshot,
        name: projectName,
        exportBackground: exportWithBackground,
        exportWithDarkMode: exportDarkMode,
        exportScale,
        exportEmbedScene: embedScene,
      },
      files,
      exportPadding: DEFAULT_EXPORT_PADDING,
      maxWidthOrHeight: Math.max(maxWidth, maxHeight),
      exportingFrame,
    })
      .then((canvas) => {
        setRenderError(null);
        // if converting to blob fails, there's some problem that will
        // likely prevent preview and export (e.g. canvas too big)
        return canvasToBlob(canvas)
          .then(() => {
            previewNode.replaceChildren(canvas);
          })
          .catch((e) => {
            if (e.name === "CANVAS_POSSIBLY_TOO_BIG") {
              throw new Error(t("canvasError.canvasTooBig"));
            }
            throw e;
          });
      })
      .catch((error) => {
        console.error(error);
        setRenderError(error);
      });
  }, [
    appStateSnapshot,
    files,
    exportedElements,
    exportingFrame,
    projectName,
    exportWithBackground,
    exportDarkMode,
    exportScale,
    embedScene,
  ]);



  return (
    <div className="PdfExportModal">
      <h3>{t("imageExportDialog.header")}</h3>
      <div className="PdfExportModal__preview">
        <div className="PdfExportModal__preview__canvas" ref={previewRef}>
          {renderError && <ErrorCanvasPreview />}
        </div>
        <div className="PdfExportModal__preview__filename">
          {!nativeFileSystemSupported && (
            <input
              type="text"
              className="TextInput"
              value={projectName}
              style={{ width: "30ch" }}
              onChange={(event) => {
                setProjectName(event.target.value);
                actionManager.executeAction(
                  actionChangeProjectName,
                  "ui",
                  event.target.value,
                );
              }}
            />
          )}
        </div>
      </div>
      <div className="PdfExportModal__settings">
        <h3>{t("pdfExportDialog.header")}</h3>
        {hasSelection && (
          <ExportSetting
            label={t("pdfExportDialog.label.onlySelected")}
            name="exportOnlySelected"
          >
            <Switch
              name="exportOnlySelected"
              checked={exportSelectionOnly}
              onChange={(checked) => {
                setExportSelectionOnly(checked);
              }}
            />
          </ExportSetting>
        )}
        <ExportSetting
          label={t("pdfExportDialog.label.withBackground")}
          name="exportBackgroundSwitch"
        >
          <Switch
            name="exportBackgroundSwitch"
            checked={exportWithBackground}
            onChange={(checked) => {
              setExportWithBackground(checked);
              actionManager.executeAction(
                actionChangeExportBackground,
                "ui",
                checked,
              );
            }}
          />
        </ExportSetting>
        {supportsContextFilters && (
          <ExportSetting
            label={t("imageExportDialog.label.darkMode")}
            name="exportDarkModeSwitch"
          >
            <Switch
              name="exportDarkModeSwitch"
              checked={exportDarkMode}
              onChange={(checked) => {
                setExportDarkMode(checked);
                actionManager.executeAction(
                  actionExportWithDarkMode,
                  "ui",
                  checked,
                );
              }}
            />
          </ExportSetting>
        )}

        <ExportSetting
          label={t("imageExportDialog.label.scale")}
          name="exportScale"
        >
          <RadioGroup
            name="exportScale"
            value={exportScale}
            onChange={(scale) => {
              setExportScale(scale);
              actionManager.executeAction(actionChangeExportScale, "ui", scale);
            }}
            choices={EXPORT_SCALES.map((scale) => ({
              value: scale,
              label: `${scale}\u00d7`,
            }))}
          />

        </ExportSetting>

        <ExportSetting
          label={t("pdfExportDialog.label.annotation")}
          name="annotation"
        >
         <Switch
            name="annotation"
            checked={exportWithAnnotations} // Bind the state to the switch
            onChange={(checked) => setExportWithAnnotations(checked)} // Update state directly inside onChange
          />
        </ExportSetting>
        
   
        
        <div className="PdfExportModal__settings__buttons">
          <FilledButton
            className="PdfExportModal__button"
            label={t("imageExportDialog.title.copyPngToClipboard")}
            onClick={() =>{
              exportToPdf({
                elements: exportedElements,
                appState: {
                  ...appStateSnapshot,
                  name: projectName,
                  exportBackground: exportWithBackground,
                  exportWithDarkMode: exportDarkMode,
                  exportScale,
                  exportWithAnnotations,
                },
                files,
                projectName,
              
              
              },)
                  console.log("exportedElements",exportedElements)
              console.log("files",files)
            }
              // {
              // console.log("exportedElements",exportedElements)
              // console.log("files",files)
              // }
            }
          >
            Export to PDF
          </FilledButton>
        </div>
      </div>
    </div>
  );
};

type ExportSettingProps = {
  label: string;
  children: React.ReactNode;
  tooltip?: string;
  name?: string;
};

const ExportSetting = ({
  label,
  children,
  tooltip,
  name,
}: ExportSettingProps) => {
  return (
    <div className="PdfExportModal__settings__setting" title={label}>
      <label
        htmlFor={name}
        className="PdfExportModal__settings__setting__label"
      >
        {label}
        {tooltip && (
          <Tooltip label={tooltip} long={true}>
            {helpIcon}
          </Tooltip>
        )}
      </label>
      <div className="PdfExportModal__settings__setting__content">
        {children}
      </div>
    </div>
  );
};

export const PdfExportDialog = ({
  elements,
  appState,
  files,
  actionManager,
  onExportImage,
  onCloseRequest,
  name,
}: {
  appState: UIAppState;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  actionManager: ActionManager;
  onExportImage: AppClassProperties["onExportImage"];
  onCloseRequest: () => void;
  name: string;
}) => {
  // we need to take a snapshot so that the exported state can't be modified
  // while the dialog is open
  const [{ appStateSnapshot, elementsSnapshot }] = useState(() => {
    return {
      appStateSnapshot: cloneJSON(appState),
      elementsSnapshot: cloneJSON(elements),
    };
  });

  return (
    <Dialog onCloseRequest={onCloseRequest} size="wide" title={false}>
      <PdfExportModal

        elementsSnapshot={elementsSnapshot}
        appStateSnapshot={appStateSnapshot}
        files={files}
        actionManager={actionManager}
        onExportImage={onExportImage}
        name={name}
      />
    </Dialog>
  );
};
