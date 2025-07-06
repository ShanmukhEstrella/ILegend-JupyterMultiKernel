import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { CodeCell } from '@jupyterlab/cells';

const extension: JupyterFrontEndPlugin<void> = {
  id: 'cell-kernel-selector',
  autoStart: true,
  requires: [INotebookTracker],
  activate: (app: JupyterFrontEnd, tracker: INotebookTracker) => {
    console.log('Stylish Kernel Selector Activated');

    // Inject Inter font
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);

    // Inject theme-aware dropdown styles
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
      .cell-kernel-selector-wrapper {
        background-color: var(--jp-layout-color1);
        border: 1px solid var(--jp-border-color2);
        border-bottom: none;
        padding: 4px 10px;
        border-top-left-radius: 8px;
        border-top-right-radius: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: 'Inter', sans-serif;
        font-size: 13px;
        font-weight: 500;
        color: var(--jp-ui-font-color1);
        height: 34px;
        overflow: hidden;
        flex-shrink: 0;
      }
      select.cell-kernel-selector-dropdown {
        padding: 5px 10px;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        border-radius: 6px;
        border: 1px solid var(--jp-border-color2);
        background-color: var(--jp-layout-color0);
        color: var(--jp-ui-font-color1);
        box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        appearance: none;
        margin-left: 6px;
        cursor: pointer;
        max-width: 150px;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);

    const availableKernels = ['-- Select Kernel --', 'Python', 'Legend'];

    const addDropdown = (cell: CodeCell): void => {
      if (!cell || !cell.node || cell.model.type !== 'code') return;

      // Only target our desired mime type
      const mimeType = cell.model.mimeType;
      if (mimeType !== 'text/x-pylegend') return;

      // Avoid duplicate injection
      if (cell.node.querySelector('.cell-kernel-selector-wrapper')) return;

      const select = document.createElement('select');
      select.className = 'cell-kernel-selector-dropdown';

      availableKernels.forEach(name => {
        const option = document.createElement('option');
        option.text = name;
        option.value = name === '-- Select Kernel --' ? '' : name;
        select.appendChild(option);
      });

      // Detect existing directive
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
      label.textContent = 'Run with:';
      wrapper.appendChild(label);
      wrapper.appendChild(select);

      const inputArea = cell.node.querySelector('.jp-InputArea');
      if (inputArea?.parentElement) {
        inputArea.parentElement.insertBefore(wrapper, inputArea);
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
        // Delay until DOM is fully painted
        requestAnimationFrame(() => {
          setTimeout(() => {
            injectDropdowns(panel);
          }, 0);
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
