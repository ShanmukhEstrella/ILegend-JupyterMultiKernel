import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

const LEGEND_MIME = 'text/x-ilegend';

/* ---------- helpers -------------------------------------------------- */
const isLegendMime = (cell: CodeCell) => cell.model.mimeType === LEGEND_MIME;
const hasDropdown  = (cell: CodeCell) =>
  !!cell.node.querySelector('.cell-kernel-selector-wrapper');

/* --------------------------------------------------------------------- */
const extension: JupyterFrontEndPlugin<void> = {
  id: 'cell-kernel-selector',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('✅ Inline Kernel Selector Activated');

    /* ---------- fonts & css ----------------------------------------- */
    const fontLink = document.createElement('link');
    fontLink.href =
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    const style = document.createElement('style');
    style.textContent = `
      select.cell-kernel-selector-dropdown option[value="Python"] {
        color: rgb(37, 235, 37);
        font-weight: 600;
      }
      select.cell-kernel-selector-dropdown option[value="Legend"] {
        color: rgb(21, 17, 224);
        font-weight: 600;
      }
      .jp-InputArea-editor.has-kernel-dropdown {
        position: relative !important;
        padding-top: 32px !important;
        padding-left: 0px !important;
      }
      .cell-kernel-selector-wrapper {
        position: absolute;
        top: 6px;
        left: 8px;
        z-index: 20;
        background-color: var(--jp-layout-color2);
        border: 1px solid var(--jp-border-color2);
        padding: 2px 6px;
        border-radius: 4px;
        display: flex;
        align-items: center;
        gap: 4px;
        font-family: 'Inter', sans-serif;
        font-size: 11px;
        font-weight: 500;
        color: var(--jp-ui-font-color1);
        box-shadow: 0 1px 2px rgba(0,0,0,0.1);
      }
      select.cell-kernel-selector-dropdown {
        padding: 2px 6px;
        font-size: 11px;
        font-family: 'Inter', sans-serif;
        border-radius: 4px;
        border: 1px solid var(--jp-border-color2);
        background-color: var(--jp-layout-color0);
        color: var(--jp-ui-font-color1);
        appearance: none;
        cursor: pointer;
        max-width: 100px;
      }
    `;
    document.head.appendChild(style);

    /* ---------- constants ------------------------------------------- */
    const availableKernels = ['-- Select Kernel --', 'Python', 'Legend'];
    const pythonHeader =
      "#Code in Python below. Don't Remove this Header!!";

    /* ---------- dropdown injector ----------------------------------- */
    const addDropdown = (cell: CodeCell): void => {
      if (!isLegendMime(cell) || hasDropdown(cell)) return;

      const select = document.createElement('select');
      select.className = 'cell-kernel-selector-dropdown';

      availableKernels.forEach(name => {
        const option = document.createElement('option');
        option.text  = name;
        option.value = name === '-- Select Kernel --' ? '' : name;
        select.appendChild(option);
      });

      let programmaticChange = false;

      const applyKernelDirective = (kernelName: string) => {
        let lines = cell.model.sharedModel.source.split('\n');
        lines = lines.filter(
          line => !line.trim().startsWith('#Kernel:') && line !== pythonHeader
        );

        let newLines: string[];
        let mimeType: string;
        let cursorLine: number;

        if (kernelName === 'Python') {
          newLines  = ['#Kernel: Python', pythonHeader, ...lines];
          mimeType  = 'text/x-python';
          cursorLine = 2;
        } else {
          newLines  = [...lines];                     // Legend
          mimeType  = LEGEND_MIME;
          cursorLine = 0;
        }

        const newSource = newLines.join('\n');
        if (cell.model.sharedModel.source === newSource) return;

        programmaticChange = true;
        cell.model.sharedModel.source = newSource;
        cell.model.mimeType = mimeType;
        programmaticChange = false;

        cell.editor?.setCursorPosition({ line: cursorLine, column: 0 });
      };

      const updateFromHeader = () => {
        if (programmaticChange) return;
        const firstLine = cell.model.sharedModel.source.split('\n')[0]?.trim().toLowerCase();
        select.value = (firstLine === '#kernel: python') ? 'Python' : 'Legend';
      };

      select.onchange = () => applyKernelDirective(select.value || 'Legend');
      cell.model.contentChanged.connect(updateFromHeader);

      /* ---- DOM ---- */
      const wrapper = document.createElement('div');
      wrapper.className = 'cell-kernel-selector-wrapper';
      const label = document.createElement('label');
      label.textContent = 'Run:';
      wrapper.appendChild(label);
      wrapper.appendChild(select);

      const editorHost = cell.node.querySelector('.jp-InputArea-editor');
      if (editorHost) {
        editorHost.appendChild(wrapper);
        editorHost.classList.add('has-kernel-dropdown');
      }

      updateFromHeader();
    };

    /* ---------- notebook‑wide hooks --------------------------------- */
    const injectDropdowns = (panel: NotebookPanel): void => {
      panel.content.widgets.forEach(c => {
        if (c.model.type === 'code') addDropdown(c as CodeCell);
      });
    };

    tracker.widgetAdded.connect((_, panel: NotebookPanel) => {
      /* load as soon as the notebook model is ready (faster than revealed) */
      panel.context.ready.then(() => {
        injectDropdowns(panel);

        /* attach to each existing code cell’s 'rendered' signal
           so any late‑created editors get the dropdown immediately */
        panel.content.widgets.forEach(c => {
        if (c.model.type === 'code') {
          requestAnimationFrame(() => addDropdown(c as CodeCell));
        }
      });
      });

      /* when a cell is added to the model */
      panel.content.model?.cells.changed.connect(() => injectDropdowns(panel));

      /* when user switches active cell */
      panel.content.activeCellChanged.connect(() => {
        const cell = panel.content.activeCell;
        if (cell?.model.type === 'code') addDropdown(cell as CodeCell);
      });
    });

    /* ---------- mime‑type watcher: remove dropdown if mime changes --- */
    tracker.currentChanged.connect(() => {
      const panel = tracker.currentWidget;
      if (!panel) return;
      panel.content.widgets.forEach(cell => {
        if (cell.model.type !== 'code') return;
        const codeCell = cell as CodeCell;
        if (hasDropdown(codeCell) && !isLegendMime(codeCell)) {
          const wrapper = codeCell.node.querySelector('.cell-kernel-selector-wrapper');
          wrapper?.remove();
          codeCell.node.querySelector('.jp-InputArea-editor')
            ?.classList.remove('has-kernel-dropdown');
        }
      });
    });
  }
};

export default extension;
