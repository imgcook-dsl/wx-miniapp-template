import { IPanelDisplay, IImport } from './interface';
const kebabCase = require('lodash/kebabCase');

import {
  COMPONENT_TYPE_MAP, COMPONENT_LIFETIMES_MAP, COMPONENT_EVENT_MAP, WXS_SYNTAX_MAP,
  prettierHtmlOpt, prettierCssOpt, prettierJsonOpt, prettierJsOpt
} from './consts'
import { parseFunction, normalizeTemplateAttrValue, parseStyle, generateCSS } from './utils'
import { DSL_CONFIG } from './consts'

export default function exportMod(schema, option): IPanelDisplay[] {

  const { _, helper, prettier, responsive } = option;
  const { printer, utils } = helper;

  const isComponent = DSL_CONFIG.outputStyle === 'component';

  const renderData: any = {};

  const line = (content, level?) =>
    utils.line(content, { indent: { space: level * 2 } });

  // style
  const styleMap = {};

  // mock data
  const mockData = {
    properties: {},
    data: {}
  };

  // script
  const scriptMap = {
    created: '',
    lifetimes: {},
    methods: {},
    data: {},
    event: {}
  };

  let modConfig = responsive || {
    width: 750,
    height: 1334
  };


  const renderTemplateAttr = (key, value) =>
    `${key}=${normalizeTemplateAttrValue({ key, value })}`;

  let depth = 0;
  let { dataSource, methods, lifeCycles, state } = schema;

  const renderTemplate = (obj, level = 0) => {
    depth = depth + 1;

    // handle node changetype
    const targetName = obj.componentName.toLowerCase();
    obj.element = COMPONENT_TYPE_MAP[targetName] || targetName;

    if (!obj.props) obj.props = {};

    // loop handler
    if (obj.loop) {
      if (typeof obj.loop === 'string') {
        obj.props[WXS_SYNTAX_MAP['for']] = `${obj.loop}`;
      } else {
        obj.props[WXS_SYNTAX_MAP['for']] = `{{${JSON.stringify(obj.loop)}}}`
      }
      obj.props[WXS_SYNTAX_MAP['forItem']] = obj.loopArgs && `${obj.loopArgs[0]}` || 'item';
      obj.props[WXS_SYNTAX_MAP['forIndex']] = obj.loopArgs && `${obj.loopArgs[1]}` || 'index';
    }

    const handlerFuncStr = option => {
      let { value, item } = option;
      if (value.content && item) {
        value.content = value.content.replace(
          new RegExp('this.' + item + '.', 'g'),
          'e.currentTarget.dataset.'
        );
      }
      return value;
    };

    // condition handler
    if (obj.condition) {
      obj.props[WXS_SYNTAX_MAP['condition']] = `${obj.condition}`;
    }

    // event handler
    for (let [key, value] of Object.entries(obj.props)) {
      if (COMPONENT_EVENT_MAP[key]) {
        obj.props[COMPONENT_EVENT_MAP[key]] = key;
        scriptMap.methods[key] = handlerFuncStr({
          value: parseFunction(value),
          item: obj.props[WXS_SYNTAX_MAP['forItem']]
        });
      }
      if (typeof value === 'string' && value.match(/this\./)) {
        obj.props[key] = value.replace(/this\./g, '');
      }
    }

    switch (obj.element) {
      case 'view':
        obj.element = 'view';
        break;
      case 'picture':
        obj.element = 'image';
        obj.children = null;
        break;
      case 'text':
        obj.children = obj.props.text;
        delete obj.props.lines;
        break;
    }

    if (obj.props.className) {
      obj.props.class = obj.props.className;
      delete obj.props.className;
      styleMap[obj.props.class] = parseStyle({
        ...obj.props.style
      });
    }
    if (obj.props.source && obj.props.src) {
      obj.props.src = obj.props.source;
      delete obj.props.source;
    }

    let ret: any[] = [];
    let nextLine = '';

    const props = Object.entries(obj.props).filter(([key, value]) => {
      if (key === 'style' && obj.props && !obj.props.class) {
        return true;
      }
      return ['style', 'text', 'onClick', 'codeStyle'].indexOf(key) < 0;
    });

    if (props.length > 3) {
      ret.push(line(`<${obj.element}`, level));
      ret = ret.concat(
        props.map(([key, value]) => {
          return line(renderTemplateAttr(key, value), level + 1);
        })
      );
    } else {
      nextLine = `<${obj.element}`;
      if (props.length) {
        nextLine += ` ${props
          .map(([key, value]) => {
            return renderTemplateAttr(key, value);
          })
          .join(' ')}`;
      }
    }

    if (obj.children) {
      if (Array.isArray(obj.children) && obj.children.length) {
        // Multi-line Child
        ret.push(line(`${nextLine}>`, level));
        ret = ret.concat(
          ...obj.children.map(o => {
            return renderTemplate(o, level + 1);
          })
        );
        ret.push(line(`</${obj.element}>`, level));
      } else {
        // Single line Child
        ret.push(line(`${nextLine}>${obj.children}</${obj.element}>`, level));
      }
    } else {
      // Self-closing label
      ret.push(line(`${nextLine} />`, level));
    }
    return ret;
  };

  // methods handler
  methods &&
    Object.entries(methods).map(([key, value]) => {
      scriptMap.methods[key] = parseFunction(value);
    });

  // lifeCycles handler
  lifeCycles &&
    Object.entries(lifeCycles).map(([key, value]) => {
      scriptMap[COMPONENT_LIFETIMES_MAP[key]] = parseFunction(value);
    });

  // dataSource &&
  //   Object.entries(dataSource).map(([key, value]) => {
  //     // console.log(key);
  //   });

  state &&
    Object.entries(state).map(([key, value]) => {
      if (value instanceof Array) {
        scriptMap.data[key] = '[]';
      } else {
        scriptMap.data[key] = JSON.stringify(value);
      }
    });

  const renderScript = scriptMap => {
    const { attached, detached, methods, created, data } = scriptMap;
    const properties = [];

    console.log('data', data)
    if (isComponent) {
      return `
      Component({
        properties: {
          ${properties.join()}
        },
        data: {
          ${Object.entries(data)
          .map(([key, value]) => {
            return `${key}: ${value}`;
          })
          .join(',')}
        },
        lifetimes: {
          created:  ${(created && `function() {${created.content}}`) ||
        `function(){}`},
          attached: ${(attached && `function() {${attached.content}}`) ||
        "function() {\n // Executed when the component instance enters the page node tree \n console.info('Page loaded!')}"},
          detached: ${(detached && `function() {${detached.content}}`) ||
        "function() {\n // Executed when the component instance is removed from the page node tree \n console.info('Page unloaded!')}"},
        },
        methods: {
          ${Object.entries(methods)
          .map(([key, value]: [string, any]) => {
            const { params, content } = value;
            return `${key}: function(${params}) {${content}}`;
          })
          .join(',')}
        },
      })
    `;
    } else {
      return `
      const app = getApp()
      Page({
        data: {
          ${Object.entries(data)
          .map(([key, value]) => {
            return `${key}: ${value}`;
          })
          .join(',')}
        },
        onLoad(){
          // 页面创建时执行
          ${created && created.content || ''}
        },
          onShow: function() {
            // 页面出现在前台时执行
          },
          onReady: function() {
            // 页面首次渲染完毕时执行
          },
          onHide: function() {
            // 页面从前台变为后台时执行
          },
          onUnload: function() {
            // 页面销毁时执行
            ${detached && detached.content || ''}
          },
          onShareAppMessage: function () {
            // 页面被用户分享时执行
          },
          onHide(){
            // 页面从前台变为后台时执行
          },
        ${Object.entries(methods)
          .map(([key, value]: [string, any]) => {
            const { params, content } = value;
            return `${key}: function(${params}) {${content}}`;
          })
          .join(',')}

      })
    `;
    }

  };

  renderData.wxml = printer(renderTemplate(schema));

  renderData.wxss = generateCSS(styleMap);
  renderData.js = prettier.format(renderScript(scriptMap), {
    parser: 'babel'
  });

  renderData.mockData = `var mock = ${JSON.stringify(mockData)}`;

  renderData.json = `{
    ${isComponent ? `"component": true,` : ''}
    "usingComponents": {}
  }`

  renderData.wxml = renderData.wxml.replace(/\{\{state\.data\./g, '{{data.');
  // renderData.js = renderData.js.replace(/state\./g, '');

  const filename = isComponent ? 'component' : 'page'
  const folder = isComponent ? 'component' : 'page'
  return [
    {
      panelName: filename + '.wxml',
      panelValue: renderData.wxml,
      panelType: 'BuilderRaxView',
      folder,
      mode: 'xml'
    },
    {
      panelName: filename + '.wxss',
      panelValue: prettier.format(renderData.wxss, prettierCssOpt),
      panelType: 'BuilderRaxStyle',
      folder,
      mode: 'css'
    },
    {
      panelName: filename + '.js',
      panelValue: prettier.format(renderData.js, prettierJsOpt),
      panelType: 'BuilderRaxView',
      folder,
      mode: 'javascript'
    },
    {
      panelName: filename + '.json',
      panelValue: prettier.format(renderData.json, prettierJsonOpt),
      panelType: 'BuilderRaxView',
      folder,
      mode: 'javascript'
    }
  ]
};
