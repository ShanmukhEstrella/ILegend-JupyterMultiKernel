import { JupyterFrontEnd, JupyterFrontEndPlugin } from '@jupyterlab/application';
import { IEditorLanguageRegistry } from '@jupyterlab/codemirror';
import { IThemeManager } from '@jupyterlab/apputils';
import {
  LRLanguage,
  LanguageSupport,
  HighlightStyle,
  syntaxHighlighting
} from '@codemirror/language';
import { Tag, styleTags, tags as t } from '@lezer/highlight';
import { parser } from './pylegend.grammar.js';

// ---------------------------
// 1. Custom highlight tags
// ---------------------------
const myNewTag1: Tag = Tag.define();
const myNewTag2: Tag = Tag.define();
// ---------------------------
// 2. Define PyLegend language
// ---------------------------
const PyLegendLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      styleTags({
        Keyword: t.keyword,
        Number: t.number,
        NewOne1: myNewTag1,
        NewOne2: myNewTag2,
        Operator: t.operator,
        Identifier: t.variableName,
        Parens: t.paren
      })
    ]
  })
});

// ---------------------------
// 3. Highlight styles
// ---------------------------
const pylegendLightStyle = HighlightStyle.define([
  { tag: myNewTag1, color: '#0c4a87', fontWeight: 'bold' },
  { tag: myNewTag2, color: '#8B4513', fontWeight: 'bold' }
]);

const pylegendDarkStyle = HighlightStyle.define([
  { tag: myNewTag1, color: '#61dafb', fontWeight: 'bold' },
  { tag: myNewTag2, color: '#ffb86c', fontWeight: 'bold' }
]);

// ---------------------------
// 4. Get LanguageSupport dynamically based on theme
// ---------------------------
function pylegendSupport(isDark: boolean): LanguageSupport {
  const style = isDark ? pylegendDarkStyle : pylegendLightStyle;
  return new LanguageSupport(PyLegendLanguage, [syntaxHighlighting(style)]);
}

// ---------------------------
// 5. Plugin definition
// ---------------------------
const plugin: JupyterFrontEndPlugin<void> = {
  id: 'pylegend-language-plugin',
  autoStart: true,
  requires: [IEditorLanguageRegistry, IThemeManager],
  activate: (
    app: JupyterFrontEnd,
    languages: IEditorLanguageRegistry,
    themeManager: IThemeManager
  ) => {
    // Dynamic loader always reflects the current theme
    const dynamicLoader = async () => {
      const isDark = themeManager.theme?.toLowerCase().includes('dark') ?? false;
      console.log(`Loading PyLegend language for ${isDark ? 'dark' : 'light'} theme`);
      return pylegendSupport(isDark);
    };

    // Register language only once — loader is dynamic
    languages.addLanguage({
      name: 'pylegend',
      mime: 'text/x-pylegend',
      extensions: ['.pylgd'],
      load: dynamicLoader
    });

    console.log('PyLegend language plugin activated with theme-aware dynamic loader');
  }
};

export default plugin;
