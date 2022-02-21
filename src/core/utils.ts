import { IImport } from './interface';
const find = require('lodash/find');
const unset = require('lodash/unset');
const camelCase = require('lodash/camelCase');
const kebabCase = require('lodash/kebabCase');
const snakeCase = require('lodash/snakeCase');

import { DSL_CONFIG } from './consts'

export const isExpression = (value) => {
  return /^\{\{.*\}\}$/.test(value);
};

// eg: hello_world => HelloWorld
export const line2Hump = (str) => {
  str = str.replace(/[_|-](\w)/g, (all, letter) => {
    return letter.toUpperCase();
  });
  str = str.charAt(0).toUpperCase() + str.slice(1);
  return str;
};

export const isEmptyObj = (o) => {
  if (o !== null && Object.prototype.toString.call(o) === '[object Object]') {
    return !Object.keys(o).length;
  }
  return false;
};

interface IComp { list?: { name: string; packageName: string; dependenceVersion: string; dependence: string }[] };
export const transComponentsMap = (compsMap: IComp = {}) => {
  if (!compsMap || !Array.isArray(compsMap.list)) {
    return [];
  }
  const list = compsMap.list;
  return list.reduce((obj, comp) => {
    const componentName = comp.name;
    if (!obj[componentName]) {
      try {
        let dependence = JSON.parse(comp.dependence);
        if (dependence) {
          comp.packageName = dependence.package;
        }
        if (!comp.dependenceVersion) {
          comp.dependenceVersion = '*';
        }
        if (/^\d/.test(comp.dependenceVersion)) {
          comp.dependenceVersion = '^' + comp.dependenceVersion;
        }
      } catch (e) { }
      obj[componentName] = comp;
    }
    return obj;
  }, {});
};

export const toString = (value) => {
  if ({}.toString.call(value) === '[object Function]') {
    return value.toString();
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'object') {
    return JSON.stringify(value, (key, value) => {
      if (typeof value === 'function') {
        return value.toString();
      } else {
        return value;
      }
    });
  }

  return String(value);
};

export const toUpperCaseStart = (value) => {
  return value.charAt(0).toUpperCase() + value.slice(1);
};


// 计数器
let counter = {};
const getCounter = (key) => {
  counter[key] = (counter[key] || 0) + 1
  return counter[key];
}

export const resetCounter = (key) => {
  counter[key] = 0;
}

/**
 * 处理schema一些常见问题
 * @param schema 
 * 1. 清理 class 空格
 * 2. 关键节点命名兜底
 */
export const initSchema = (schema) => {
  //  重置计数器
  resetCounter('page');
  resetCounter('block');
  resetCounter('component');

  // 清理 class 空格
  traverse(schema, (node) => {
    if (node && node.props && node.props.className) {
      node.props.className = String(node.props.className).trim();
    }
  });

  // 关键节点命名兜底
  traverse(schema, (json) => {
    json.componentName = json.componentName || ''
    switch (json.componentName.toLowerCase()) {
      case 'page':
        json.fileName = line2Hump(json.fileName || `page_${getCounter('page')}`);
        break;
      case 'block':
        json.fileName = line2Hump(json.fileName || `block_${getCounter('block')}`);
        break;
      case 'component':
        json.fileName = line2Hump(json.fileName || `component_${getCounter('component')}`);
        break;
      default:
        break;
    }
  });
};

// 遍历节点
export const traverse = (json, callback) => {
  if (Array.isArray(json)) {
    json.forEach((node) => {
      traverse(node, callback)
    });
    return
  }

  // 去除 class 空格
  if (json && callback) {
    callback(json)
  }

  if (
    json.children &&
    json.children.length > 0 &&
    Array.isArray(json.children)
  ) {
    json.children.forEach((child) => {
      traverse(child, callback);
    });
  }
};

export const genStyleClass = (string, type) => {
  let classArray = string.split(' ');
  classArray = classArray.filter(name => !!name);
  classArray = classArray.map(name => {
    switch (type) {
      case 'camelCase': return camelCase(name);
      case 'kebabCase': return kebabCase(name);
      case 'snakeCase': return snakeCase(name);
      default:
        return camelCase(name);
    }
  });
  return classArray.join(' ')
}

export const genStyleCode = (styles, key = '') => {
  return !/-/.test(key) && key.trim()
    ? `${styles}.${key}`
    : `${styles}['${key}']`;
};

// parse function, return params and content
export const parseFunction = func => {
  const funcString = func.toString();
  const params = funcString.match(/\([^\(\)]*\)/)[0].slice(1, -1);
  const content = funcString.slice(
    funcString.indexOf('{') + 1,
    funcString.lastIndexOf('}')
  );
  return {
    params,
    content
  };
};


export const parseNumberValue = (value) => {
  const { cssUnit = 'px', scale, responseWidth } = DSL_CONFIG
  value = String(value).replace(/\b[\d\.]+(px|rem|rpx|vw)?\b/, (v) => {
    const nv = parseFloat(v);
    if (!isNaN(nv) && nv !== 0) {
      return toString(nv);
    } else {
      return 0;
    }
  });
  if (/^\-?[\d\.]+$/.test(value)) {
    value = parseFloat(value);
    if (cssUnit == 'rpx') {
      value = 750 * value / Number(responseWidth);
      value = value == 0 ? value : value + 'rpx';
    } else if (cssUnit == 'rem') {
      const htmlFontSize = DSL_CONFIG.htmlFontSize || 16;
      value = parseFloat((value / htmlFontSize).toFixed(2));
      value = value ? `${value}rem` : value;
    } else if (cssUnit == 'vw') {
      const _w = 750 / scale
      value = (100 * parseInt(value) / _w).toFixed(2);
      value = value == 0 ? value : value + 'vw';
    } else {
      value += cssUnit;
    }
  }
  return value;
};


export const normalizeStyleValue = (key, value, config) => {
  switch (key) {
    case 'font-size':
    case 'margin-left':
    case 'margin-top':
    case 'margin-right':
    case 'margin-bottom':
    case 'padding-left':
    case 'padding-top':
    case 'padding-right':
    case 'padding-bottom':
    case 'max-width':
    case 'width':
    case 'height':
    case 'border-width':
    case 'border-radius':
    case 'top':
    case 'left':
    case 'right':
    case 'bottom':
    case 'line-height':
    case 'letter-spacing':
    case 'border-top-right-radius':
    case 'border-top-left-radius':
    case 'border-bottom-left-radius':
    case 'border-bottom-right-radius':
      value = '' + value;
      if (value.endsWith('%')) {
        break;
      }
      if (value) {
        value = parseNumberValue(value);
      }

      // value = value.replace(/(rem)|(px)/, '');
      // value = (Number(value) * 750) / config.width;
      // value = '' + value;

      // if (value.length > 3 && value.substr(-3, 3) == 'rem') {
      //   value = value.slice(0, -3) + 'rpx';
      // } else {
      //   value += 'rpx';
      // }
      break;
    default:
      break;
  }
  return value;
};

// flexDirection -> flex-direction
export const parseCamelToLine = (string) => {
  return string
    .split(/(?=[A-Z])/)
    .join('-')
    .toLowerCase();
};


// convert to responsive unit, such as vw
export const parseStyle = (style) => {
  const { scale } = DSL_CONFIG
  const resultStyle = {}
  for (let key in style) {
    switch (key) {
      case 'fontSize':
      case 'marginTop':
      case 'marginBottom':
      case 'paddingTop':
      case 'paddingBottom':
      case 'height':
      case 'top':
      case 'bottom':
      case 'width':
      case 'maxWidth':
      case 'left':
      case 'right':
      case 'paddingRight':
      case 'paddingLeft':
      case 'marginLeft':
      case 'marginRight':
      case 'lineHeight':
      case 'borderBottomRightRadius':
      case 'borderBottomLeftRadius':
      case 'borderTopRightRadius':
      case 'borderTopLeftRadius':
      case 'borderRadius':
        resultStyle[key] = '' + resultStyle[key];
        if (resultStyle[key].endsWith('%')) {
          break;
        }
        resultStyle[key] = parseInt(style[key]) * scale;
        if (style[key]) {
          resultStyle[key] = parseNumberValue(style[key]);
        }
        break;
      default:
        if (style[key] && String(style[key]).includes('px')) {
          resultStyle[key] = String(style[key]).replace(/[\d\.]+px/g, (v) => {
            return /^[\d\.]+px$/.test(v) ? parseNumberValue(v) : v;
          })
        }
        resultStyle[key] = resultStyle[key] || style[key]
    }
  }

  return resultStyle;
};


/**
 * （1）定位属性：position  display  float  left  top  right  bottom   overflow  clear   z-index
（2）自身属性：width  height  padding  border  margin   background
（3）文字样式：font-family   font-size   font-style   font-weight   font-varient   color   
（4）文本属性：text-align   vertical-align   text-wrap   text-transform   text-indent    text-decoration   letter-spacing    word-spacing    white-space   text-overflow
（5）css3中新增属性：content   box-shadow   border-radius  transform……
 */
const orderMap = [
  "position", "display", "float", "left", "top", "right", "bottom",
  "flex-direction", "justify-content", "align-items", "align-self", "overflow", "clear", "z-index",
  "width", "height", "max-width", "max-height", "padding", "padding-bottom", "padding-left", "padding-right", "padding-left", "border", "margin", "margin-top", "margin-bottom", "margin-left", "margin-right", "background",
  "background-color", "background-image", "background-size",
  "font-family", "font-size", "font-style", "font-weight", "font-varient", "line-height", "color", "text-align", "vertical-align", "text-wrap", "text-transform", "text-indent", "text-decoration",
  "letter-spacing", "word-spacing", "white-space", "text-overflow",
  "content", "box-shadow", "border-radius", "transform"
]
// genrate css object string
export const generateCssString = (style) => {
  let css = '';
  let array: any[] = [];

  // 缩写margin
  const margin = Object.keys(style).filter(item => item.startsWith("margin"));
  if (!style['margin'] && margin.length > 2) {
    style["margin"] = `${style["marginTop"] || 0} ${style["marginRight"] || 0} ${style["marginBottom"] || 0} ${style["marginLeft"] || 0}`
    delete style["marginTop"];
    delete style["marginLeft"];
    delete style["marginBottom"];
    delete style["marginRight"];
  }

  // 缩写 padding
  const padding = Object.keys(style).filter(item => item.startsWith("padding"));
  if (!style['padding'] && padding.length > 2) {
    style["padding"] = `${style["paddingTop"] || 0} ${style["paddingRight"] || 0} ${style["paddingBottom"] || 0} ${style["paddingLeft"] || 0}`
    delete style["paddingTop"];
    delete style["paddingLeft"];
    delete style["paddingBottom"];
    delete style["paddingRight"];
  }

  for (let key in style) {
    const cssKey = parseCamelToLine(key);
    const orderIndex = orderMap.indexOf(cssKey);

    array.push({
      key: cssKey,
      value: style[key],
      index: orderIndex == -1 ? 100 : orderIndex
    })
  }


  array.sort((a, b) => {
    return a.index - b.index
  })

  css = array.map(item => {
    return `${item.key}: ${item.value};`
  }).join('');

  return css
}

// style obj -> css
export const generateCSS = (style, prefix = '') => {
  let css = '';

  for (let layer in style) {
    css += `${prefix && prefix !== layer ? '.' + prefix + ' ' : ''}.${layer} {`;
    css += generateCssString(style[layer])
    css += '}'
  }

  return css;
};



export const normalizeTemplateAttrValue = ({ key, value }) => {
  if (typeof value === 'string') {
    return JSON.stringify(value);
  } else if (key === 'style') {
    var str = '"';
    
    value = parseStyle(value)
    Object.entries(value).map(([k, val]) => {
      str += `${kebabCase(k)}:${val};`
    });
    return `${str}"`;
  } else {
    return `"${JSON.stringify(value)}"`;
  }
};