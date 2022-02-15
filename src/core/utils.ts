import { IImport } from './interface';
const find = require('lodash/find');
const unset = require('lodash/unset');
const camelCase = require('lodash/camelCase');
const kebabCase = require('lodash/kebabCase');
const snakeCase = require('lodash/snakeCase');
const cssParser = require('css/lib/parse');

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

export const genStyleCode = (styles, key='') => {
  return !/-/.test(key) && key.trim()
    ? `${styles}.${key}`
    : `${styles}['${key}']`;
};