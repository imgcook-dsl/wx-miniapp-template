
module.exports = function(schema, options) {
  const renderData = {};
  const { _, helper, prettier, responsive } = options;
  const { printer, utils } = helper;

  const line = (content, level) =>
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

  const parseStyleObject = style =>
    Object.entries(style)
      .filter(([, value]) => value || value === 0)
      .map(([key, value]) => {
        key = _.kebabCase(key);
        return `${key}: ${normalizeStyleValue(key, value, modConfig)};`;
      });

  const renderStyleItem = (className, style) => [
    line(`.${className} {`),
    ...parseStyleObject(style).map(item => line(item, 1)),
    line('}')
  ];

  const renderStyle = map =>
    [].concat(
      ...Object.entries(map).map(([className, style]) =>
        renderStyleItem(className, style)
      )
    );

  const normalizeTemplateAttrValue = value => {
    if (typeof value === 'string') {
      return JSON.stringify(value);
    } else {
      return `"${JSON.stringify(value)}"`;
    }
  };

  const renderTemplateAttr = (key, value) =>
    `${key}=${normalizeTemplateAttrValue(value)}`;

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
        obj.props[WXS_SYNTAX_MAP['for']] = `{{${obj.loop.split('.').pop()}`;
      } else {
        obj.props[WXS_SYNTAX_MAP['for']] = `{{${JSON.stringify(obj.loop)}}}`
      }
      obj.props[WXS_SYNTAX_MAP['forItem']] = obj.loopArgs && `${obj.loopArgs[0]}` || 'item';
      obj.props[WXS_SYNTAX_MAP['forIndex']] = obj.loopArgs && `${obj.loopArgs[1]}` || 'index';
    }

    const handlerFuncStr = options => {
      let { value, item } = options;
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
        break;
    }

    if (obj.props.className) {
      obj.props.class = _.kebabCase(obj.props.className);
      delete obj.props.className;
      styleMap[obj.props.class] = {
        ...styleMap[obj.props.class],
        ...obj.props.style
      };
    }
    if (obj.props.source && obj.props.src) {
      obj.props.src = obj.props.source;
      delete obj.props.source;
    }

    let ret = [];
    let nextLine = '';

    const props = Object.entries(obj.props).filter(([key, value]) => {
      return ['style', 'text', 'onClick'].indexOf(key) < 0;
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
            .map(([key, value]) => {
              const { params, content } = value;
              return `${key}: function(${params}) {${content}}`;
            })
            .join(',')}
        },
      })
    `;
  };

  renderData.wxml = printer(renderTemplate(schema));
  renderData.wxss = printer(renderStyle(styleMap));
  renderData.js = prettier.format(renderScript(scriptMap), {
    parser: 'babel'
  });

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
        mode: 'xml'
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
        mode: 'javascript'
      },
      {
        panelName: 'component.json',
        panelValue: renderData.json,
        panelType: 'BuilderRaxView',
        mode: 'javascript'
      }
    ],
    playground: {
      info: '前往下载微信开发者工具',
      link:
        'https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html'
    },
    noTemplate: true
  };
};

const COMPONENT_TYPE_MAP = {
  page: 'view',
  div: 'view',
  link: 'view',
  video: 'video',
  expview: 'view',
  scroller: 'scroll-view',
  slider: 'swiper',
  view: 'view',
  text: 'text',
  picture: 'image'
};

const COMPONENT_LIFETIMES_MAP = {
  _constructor: 'created',
  render: '',
  componentDidMount: 'attached',
  componentDidUpdate: '',
  componentWillUnmount: 'detached'
};

const COMPONENT_EVENT_MAP = {
  onClick: 'bindtap',
};

const WXS_SYNTAX_MAP = {
  for: 'wx:for',
  forItem: 'wx:for-item',
  forIndex: 'wx:for-index',
  condition: 'wx:if'
};

// parse function, return params and content
const parseFunction = func => {
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

const normalizeStyleValue = (key, value, config) => {
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
      value = (Number(value) * 750) / config.width;
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
