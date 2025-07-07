import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

const extension: JupyterFrontEndPlugin<void> = {
  id: 'cell-kernel-selector',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('Inline Kernel Selector Activated (Top-left Compact)');

    // Inject Inter font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Inject styles
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

      .jp-InputArea-editor {
        position: relative !important;
        padding-top: 32px !important; /* enough space for dropdown */
        padding-left: 140px !important; /* leave space for dropdown */
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
        pointer-events: auto;
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

    const availableKernels = ['-- Select Kernel --', 'Python', 'Legend'];

    const addDropdown = (cell: CodeCell): void => {
      if (!cell || !cell.node || cell.model.type !== 'code') return;

      const mimeType = cell.model.mimeType;
      if (mimeType !== 'text/x-pylegend') return;

      if (cell.node.querySelector('.cell-kernel-selector-wrapper')) return;

      const select = document.createElement('select');
      select.className = 'cell-kernel-selector-dropdown';

      availableKernels.forEach(name => {
        const option = document.createElement('option');
        option.text = name;
        option.value = name === '-- Select Kernel --' ? '' : name;
        select.appendChild(option);
      });

      const codeLines = cell.model.sharedModel.source.split('\n');
      const match = codeLines[0]?.match(/^#Kernel:\s*(\S+)/);
      if (match) select.value = match[1];

      select.onchange = () => {
        const selected = select.value;
        const lines = cell.model.sharedModel.source.split('\n');
        if (lines[0]?.startsWith('#Kernel:')) lines.shift();
        if (selected) {
          cell.model.sharedModel.source = [`#Kernel: ${selected}`, ...lines].join('\n');
        } else {
          cell.model.sharedModel.source = lines.join('\n');
        }
      };

      const wrapper = document.createElement('div');
      wrapper.className = 'cell-kernel-selector-wrapper';

      const label = document.createElement('label');
      label.textContent = 'Run:';
      wrapper.appendChild(label);
      wrapper.appendChild(select);

      const editorHost = cell.node.querySelector('.jp-InputArea-editor');
      if (editorHost) {
        editorHost.appendChild(wrapper);
      }
    };

    const injectDropdowns = (panel: NotebookPanel): void => {
      panel.content.widgets.forEach(cell => {
        if (cell.model.type === 'code') {
          addDropdown(cell as CodeCell);
        }
      });
    };

    tracker.widgetAdded.connect((_, panel: NotebookPanel) => {
      panel.revealed.then(() => {
        requestAnimationFrame(() => {
          setTimeout(() => injectDropdowns(panel), 0);
        });
      });

      panel.content.model?.cells.changed.connect(() => {
        requestAnimationFrame(() => {
          setTimeout(() => injectDropdowns(panel), 0);
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
