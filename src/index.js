module.exports = function (layoutData, opts) {
  if (layoutData.attrs.className === 'root') {
    layoutData = layoutData.children[0];
  }
  const renderData = {};
  const { _, helper, prettier } = opts;
  const { printer, utils } = helper;

  const COMPONENT_TYPE_MAP = {
    'link': 'view',
    'video': 'video',
    'expview': 'view',
    'scroller': 'scroll-view',
    'slider': 'swiper',
    'view': 'view',
    'text': 'text',
    'picture': 'image',
  };
  const line = (content, level) => utils.line(content, { indent: { space: level * 2 } });
  const styleMap = {};
  const mockData = {
    properties: {},
    data: {},
  };
  const scriptMap = {
    created: '',
    detached: '',
    methods: {},
  };
  let modConfig = layoutData.modStyleConfig || {
    designWidth: 750,
    designHeight: 1334
  };
  const normalizeStyleValue = (key, value) => {
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
        value = value.replace(/(rem)|(px)/, '');
        value = Number(value) * 750 / modConfig.designWidth;
        value = '' + value;

        if (value.length > 3 && value.substr(-3, 3) == 'rem') {
          value = value.slice(0, -3) + 'rpx';
        } else {
          value += 'rpx';
        }
        break;
      default:
        break;
    }
    return value;
  };

  const parseStyleObject = style => Object.entries(style).filter(([, value]) => value || value === 0).map(([key, value]) => {
    key = _.kebabCase(key);
    return `${key}: ${normalizeStyleValue(key, value)};`;
  });

  const renderStyleItem = (className, style) => [
    line(`.${className} {`),
    ...parseStyleObject(style).map(item => line(item, 1)),
    line('}')
  ];

  const renderStyle = map => [].concat(
    ...Object.entries(map).map(([className, style]) => renderStyleItem(className, style))
  );

  const normalizeTemplateAttrValue = value => {
    if (typeof value === 'string') {
      return JSON.stringify(value);
    } else {
      return `"${JSON.stringify(value)}"`;
    }
  };

  const renderTemplateAttr = (key, value) => `${key}=${normalizeTemplateAttrValue(value)}`;
  const getFuncBody = (content) => {
    if (content) {
      return content.match(/(?:\/\*[\s\S]*?\*\/|\/\/.*?\r?\n|[^{])+\{([\s\S]*)\};$/)[1];
    }
    return '';
  };
  let depth = 0;
  let { dataBindingStore } = layoutData;

  const getScriptStore = (originJson) => {
    return (originJson.eventStore && originJson.scriptStore) ?  (originJson.eventStore || []).map((v) => {
      const contentStore = (originJson.scriptStore || []).find(_v => _v.id === v.scriptId);
      return {
        belongId: v.belongId,
        content: contentStore.content,
        eventType: v.type,
        scriptName: contentStore.name,
      };
    }) : (originJson.scriptStore || []) ;
  };
  // let scriptStore = originJson.scriptStore || [];
  let scriptStore = getScriptStore(layoutData);

  const renderTemplate = (obj, level = 0) => {
    depth = depth + 1;

    if (Array.isArray(scriptStore)) { // 事件绑定
      if (scriptStore.length > 0) {
        scriptStore.forEach(({ belongId, eventType, scriptName, content }, index) => {
          if (belongId === obj.id) {
            if (depth === 1) {
              if (eventType === 'init') {
                scriptMap.created = `
                  function () {
                    ${getFuncBody(content)}
                  }
                `;
              } else if (eventType === 'destroy') {
                scriptMap.detached = `
                  function () {
                    ${getFuncBody(content)}
                  }
                `;
              }
            }
            if (eventType === 'onClick') {
              scriptMap.methods.onTap = `
                function () {
                  ${getFuncBody(content)}
                }
              `;
              obj.attrs.bindtap = 'onTap';
            }
            if (eventType === 'helper') {
              scriptMap.methods[scriptName] = `
                function () {
                  ${getFuncBody(content)}
                }
              `;
            }
          }
        });
      }
    }
    // 数据绑定
    let domDataBinding = [];
    if (Array.isArray(dataBindingStore)) {
      domDataBinding = dataBindingStore.filter(v => {
        if (v.belongId == obj.id) {
          if (v.value && v.value.isStatic) {
            return true;
          } else {
            if (v.value) {
              const source = v.value.source;
              const sourceValue = v.value.sourceValue;
              if (source && sourceValue) {
                return true;
              }
            }
            return false;
          }
        }
      });
    }
    // console.log(`${obj.id}的数据绑定对象`, domDataBinding);
    // 处理changetype
    // obj.element = obj.changeType === 'video' ? obj.changeType : obj.componentType;
    obj.element = COMPONENT_TYPE_MAP[ obj.componentType ] || obj.componentType;
    if (!obj.style) obj.style = {};
    if (!obj.attrs) obj.attrs = {};

    if (obj.style.borderWidth) {
      obj.style.boxSizing = 'border-box';
    }

    if (obj.type && obj.type.toLowerCase() === 'repeat') {
      obj.style.display = 'flex';
      obj.style.flexDirection = 'row';
      obj.children.forEach(function (child) {
        delete child.style.marginTop;
      });
    }

    domDataBinding.map(item => {
      const target = item.target[0];
      if (item.value.isStatic) { // 静态数据
        obj.attrs[target] = item.value.value;
      } else {
        const sourceValue = item.value.sourceValue;
        let value = '';
        if (Array.isArray(sourceValue)) {
          value = sourceValue.map(item => {
            if (item.type === 'DYNAMIC') {
              return `{{${item.value.slice(2, -1)}}}`
            }
            return item.value;
          }).join('');
        } else { // 通过schema绑定 @TODO
          value = `{{${item.value.source}.${item.value.sourceValue}}}`
        }
        if (target === 'show') {
          obj.attrs['wx:if'] = value;
        } else if (target === 'innerText') {
          obj.innerText = value;
        } else {
          obj.attrs[target] = value;
        }
      }
    });
    switch (obj.element) {
      case 'view':
        obj.element = 'view';
        obj.style.display = 'flex';
        break;
      case 'picture':
        obj.element = 'image';
        obj.children = null;
        break;
      case 'text':
        obj.children = obj.innerText;
        break;
    }

    if (obj.style.lines == 1 || obj.attrs.lines == 1) {
      delete obj.style.width;
    }

    delete obj.style.lines;
    delete obj.attrs.x;
    delete obj.attrs.y;
    if (obj.attrs.className) {
      obj.attrs.class = _.kebabCase(obj.attrs.className);
      delete obj.attrs.className;
    }
    if (obj.attrs.source && obj.attrs.src) {
      obj.attrs.src = obj.attrs.source;
      delete obj.attrs.source;
    }
    obj.attrs.class = `${obj.attrs.class}`
    styleMap[obj.attrs.class] = {
      ...styleMap[obj.attrs.class],
      ...obj.style
    };

    let ret = [];
    let nextLine = '';
    const attrs = Object.entries(obj.attrs).filter(([key, value]) => {
      if (obj.element === 'image') {
        return (
          [
            'class',
            'src',
          ].includes(key)
        );
      } else if (obj.element === 'video') {
        return (
          [
            'class',
            'src',
            'controls',
            'autoplay',
            'muted',
            'poster',
          ].includes(key)
        );
      }
      return key === 'class';
    });
    if (attrs.length > 3) {
      ret.push(line(`<${obj.element}`, level));
      ret = ret.concat(attrs.map(([key, value]) => line(renderTemplateAttr(key, value), level + 1)));
    } else {
      nextLine = `<${obj.element}`;
      if (attrs.length) {
        nextLine += ` ${attrs.map(([key, value]) => renderTemplateAttr(key, value)).join(' ')}`;
      }
    }
    if (obj.children) {
      if (Array.isArray(obj.children) && obj.children.length) {
        // 多行 Child
        ret.push(line(`${nextLine}>`, level));
        ret = ret.concat(...obj.children.map(o => renderTemplate(o, level + 1)));
        ret.push(line(`</${obj.element}>`, level));
      } else {
        // 单行 Child
        ret.push(line(`${nextLine}>${obj.children}</${obj.element}>`, level));
      }
    } else {
      // 自闭合标签
      ret.push(line(`${nextLine} />`, level));
    }
    return ret;
  };

  const renderScript = (scriptMap, dataBindingStore = []) => {
    const { attached, detached, methods } = scriptMap;
    const properties = [];
    dataBindingStore.forEach(item => {
      if (!item.value.isStatic) {
        const { value: { sourceValue } } = item
        if (Array.isArray(sourceValue)) {
          sourceValue.forEach(v => {
            const key = v.value.slice(7, -1);
            if (key) {
              properties.push(`${key}: String`);
            }
          });
        }
      }
    });
    return `
      Component({
        properties: {
          ${properties.join()}
        },
        data: {},
        attached: ${attached || 'function() {}'},
        detached: ${detached || 'function() {}'},
        methods: {
          ${Object.entries(methods).map(([key, value]) => {
      return `${key}: ${value}`;
    }).join(',')}
        },
      })
    `
  };

  renderData.wxml = printer(renderTemplate(layoutData));
  renderData.wxss = printer(renderStyle(styleMap));
  renderData.js = prettier.format(renderScript(scriptMap, dataBindingStore), { parser: 'babel' });

  renderData.mockData = `var mock = ${JSON.stringify(mockData)}`;
  renderData.json = printer([
    line('{'),
    line('"component": true,', 1),
    line('"usingComponents": {}', 1),
    line('}')
  ]);

  return {
    renderData,
    prettierOpt: {},
    panelDisplay: [
      {
        panelName: 'component.wxml',
        panelValue: renderData.wxml,
        panelType: 'BuilderRaxView',
        mode: 'xml',
      },
      {
        panelName: 'component.wxss',
        panelValue: renderData.wxss,
        panelType: 'BuilderRaxStyle',
        mode: 'css'
      },
      {
        panelName: 'component.js',
        panelValue: renderData.js,
        panelType: 'BuilderRaxView',
        mode: 'javascript',
      },
      {
        panelName: 'component.json',
        panelValue: renderData.json,
        panelType: 'BuilderRaxView',
        mode: 'javascript',
      }
    ],
    playground: {
      info: '前往下载微信开发者工具',
      link: 'https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html'
    },
    noTemplate: true,
  };
};