/**
 * Inline kernel selector for ILegend notebooks
 * -------------------------------------------
 * Adds a dropdown to every code cell so users can switch between the
 * ILegend kernel and a Python helper kernel.
 */

import {
  JupyterFrontEnd,
  JupyterFrontEndPlugin
} from '@jupyterlab/application';

import {
  INotebookTracker,
  NotebookPanel
} from '@jupyterlab/notebook';

import { CodeCell } from '@jupyterlab/cells';



const LEGEND_MIME = 'text/x-ilegend';

const isLegendMime = (cell: CodeCell) =>
  cell.model.mimeType === LEGEND_MIME;

const hasDropdown = (cell: CodeCell) =>
  !!cell.node.querySelector('.cell-kernel-selector-wrapper');



const extension: JupyterFrontEndPlugin<void> = {
  id: 'cell-kernel-selector',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('✅ Inline Kernel Selector Activated');


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
        padding-left: 0 !important;
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
        max-width: 120px;
      }
    `;
    document.head.appendChild(style);


    const availableKernels = ['-- Select Kernel --', 'Python', 'Legend'];
    const pythonHeader =
      "#Code in Python below. Don't Remove this Header!!";


    const addDropdown = (cell: CodeCell): void => {
      if (hasDropdown(cell)) return;              // already injected

      const host = cell.node.querySelector('.jp-InputArea-editor');
      if (!host) return;                          


      const select = document.createElement('select');
      select.className = 'cell-kernel-selector-dropdown';
      availableKernels.forEach(name => {
        const opt = document.createElement('option');
        opt.text  = name;
        opt.value = name === '-- Select Kernel --' ? '' : name;
        select.appendChild(opt);
      });

      let programmaticChange = false;

      const applyKernelDirective = (kernelName: 'Python' | 'Legend') => {

        let lines = cell.model.sharedModel.source
          .split('\n')
          .filter(l => !l.trim().startsWith('#Kernel:') && l !== pythonHeader);

        let newLines: string[];
        let mimeType: string;
        let cursorLine: number;

        if (kernelName === 'Python') {
          newLines   = ['#Kernel: Python', pythonHeader, ...lines];
          mimeType   = 'text/x-python';
          cursorLine = 2;
        } else {
          newLines   = [...lines]; 
          mimeType   = LEGEND_MIME;
          cursorLine = 0;
        }

        const newSource = newLines.join('\n');
        if (newSource === cell.model.sharedModel.source) return;

        programmaticChange = true;
        cell.model.sharedModel.source = newSource;
        cell.model.mimeType           = mimeType;
        programmaticChange = false;

        cell.editor?.setCursorPosition({ line: cursorLine, column: 0 });
      };

      const syncFromHeader = () => {
        if (programmaticChange) return;
        const first = cell.model.sharedModel.source
          .split('\n')[0]
          ?.trim()
          .toLowerCase();
        select.value = first === '#kernel: python' ? 'Python' : 'Legend';
      };


      select.onchange = () =>
        applyKernelDirective((select.value || 'Legend') as any);
      cell.model.contentChanged.connect(syncFromHeader);

      // react to later MIME switches
      cell.model.mimeTypeChanged.connect(() => {
        if (!hasDropdown(cell) && isLegendMime(cell)) addDropdown(cell);
        if (hasDropdown(cell) && !isLegendMime(cell)) {
          cell.node
            .querySelector('.cell-kernel-selector-wrapper')
            ?.remove();
          host.classList.remove('has-kernel-dropdown');
        }
      });


      const wrapper = document.createElement('div');
      wrapper.className = 'cell-kernel-selector-wrapper';
      wrapper.innerHTML = `<label>Run:</label>`;
      wrapper.appendChild(select);

      host.appendChild(wrapper);
      host.classList.add('has-kernel-dropdown');

      syncFromHeader();
    };


    const injectDropdowns = (panel: NotebookPanel) => {
      panel.content.widgets.forEach(c => {
        if (c.model.type === 'code') addDropdown(c as CodeCell);
      });
    };


    tracker.widgetAdded.connect((_, panel) => {
      panel.context.ready.then(() => {
        injectDropdowns(panel);
      });


      panel.content.model?.cells.changed.connect((_list, change) => {
        change.newValues?.forEach(modelCell => {
          if (modelCell.type !== 'code') return;
          const viewCell = panel.content.widgets.find(
            w => w.model === modelCell
          ) as CodeCell | undefined;
          if (!viewCell) return;
          viewCell.ready.then(() =>
            requestAnimationFrame(() => addDropdown(viewCell))
          );
        });
      });


      panel.content.activeCellChanged.connect(() => {
        const cell = panel.content.activeCell;
        if (cell?.model.type === 'code') addDropdown(cell as CodeCell);
      });
    });
  }
};

export default extension;
