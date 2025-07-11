import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

const extension: JupyterFrontEndPlugin<void> = {
  id: 'cell-kernel-selector',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('✅ Inline Kernel Selector Activated');

    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
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

    const availableKernels = ['-- Select Kernel --', 'Python', 'Legend'];
    const pythonHeader = "#Code in Python below. Don't Remove this Header!!";

    const addDropdown = (cell: CodeCell): void => {
      if (!cell || !cell.node || cell.model.type !== 'code') return;
      if (cell.node.querySelector('.cell-kernel-selector-wrapper')) return;

      const select = document.createElement('select');
      select.className = 'cell-kernel-selector-dropdown';

      availableKernels.forEach(name => {
        const option = document.createElement('option');
        option.text = name;
        option.value = name === '-- Select Kernel --' ? '' : name;
        select.appendChild(option);
      });

      let programmaticChange = false;

      const applyKernelDirective = (kernelName: string) => {
        let lines = cell.model.sharedModel.source.split('\n');
        lines = lines.filter(line =>
          !line.trim().startsWith('#Kernel:') && line !== pythonHeader
        );

        let newLines: string[];
        let mimeType: string;
        let cursorLine: number;

        if (kernelName === 'Python') {
          newLines = [`#Kernel: Python`, pythonHeader, ...lines];
          mimeType = 'text/x-python';
          cursorLine = 2;
        } else {
          newLines = [...lines];  // Legend
          mimeType = 'text/x-ilegend';
          cursorLine = 0;
        }

        const newSource = newLines.join('\n');
        if (cell.model.sharedModel.source === newSource) return;

        programmaticChange = true;
        cell.model.sharedModel.source = newSource;
        cell.model.mimeType = mimeType;
        programmaticChange = false;

        requestAnimationFrame(() => {
          cell.editor?.setCursorPosition({ line: cursorLine, column: 0 });
        });
      };

      const updateFromHeader = () => {
        if (programmaticChange) return;

        const lines = cell.model.sharedModel.source.split('\n');
        const first = lines[0]?.trim().toLowerCase();

        if (first === '#kernel: python') {
          select.value = 'Python';
          applyKernelDirective('Python');
        } else {
          select.value = 'Legend';
          applyKernelDirective('Legend');
        }
      };

      select.onchange = () => {
        const selected = select.value;
        if (selected) {
          applyKernelDirective(selected);
        } else {
          applyKernelDirective('Legend');
        }
      };

      cell.model.contentChanged.connect(() => {
        updateFromHeader();
      });

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

    const injectDropdowns = (panel: NotebookPanel): void => {
      panel.content.widgets.forEach(cell => {
        if (cell.model.type === 'code') addDropdown(cell as CodeCell);
      });
    };

    tracker.widgetAdded.connect((_, panel: NotebookPanel) => {
      panel.revealed.then(() => {
      injectDropdowns(panel);
      const firstCell = panel.content.widgets.find(cell => cell.model.type === 'code') as CodeCell;
      if (firstCell) {
        requestAnimationFrame(() => {
          // Force update by resetting the source to itself
          firstCell.model.sharedModel.source = firstCell.model.sharedModel.source;
        });
      }
    });
      panel.content.model?.cells.changed.connect(() => injectDropdowns(panel));
      panel.content.activeCellChanged.connect(() => {
        const cell = panel.content.activeCell;
        if (cell?.model.type === 'code') addDropdown(cell as CodeCell);
      });
    });
  }
};

export default extension;
