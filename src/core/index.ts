import { IPanelDisplay } from './interface';
import {
  isExpression,
  initSchema,
  traverse,
  genStyleClass,
} from './utils';
const kebabCase = require('lodash/kebabCase');

import { initConfig } from './consts';
import exportMod from './exportMod';

module.exports = function (schema, option) {
  option.scale = 750 / ((option.responsive && option.responsive.width) || 750);
  const dslConfig = Object.assign(
    {
      scale: option.scale,
      cssUnit: 'rpx',
      htmlFontSize: 16,
      outputStyle: 'component'
    },
    option._.get(schema, 'imgcook.dslConfig')
  );
  
  option.dslConfig = dslConfig;

  // 初始化全局参数
  initConfig(dslConfig);

  initSchema(schema);
  // 样式名处理：指定命名风格
  traverse(schema, (json) => {
    if (json.props && json.props.className) {
      json.props.className = genStyleClass(
        json.props.className,
        dslConfig.cssStyle
      );
    }
  });

    // 提取全局样式，类名数组存于 json.classString , 剩余样式覆盖 style
  traverse(schema, (json) => {
    let className = json.props && json.props.className || '';
    if(!className){
      return
    }

    let fileStyle = {};
    let codeStyles = {};

    Object.keys(json.props.style || {}).forEach(key => {
      if (isExpression(json.props.style[key])) {
        codeStyles[key] = json.props.style[key]
      } else {
        fileStyle[key] = json.props.style[key]
      }
    });
   
    json.props.codeStyle = codeStyles;
    json.props.style = fileStyle;
  });

  let panelDisplay: IPanelDisplay[] = [];

  panelDisplay = panelDisplay.concat(exportMod(schema, option));

  return {
    panelDisplay,
    noTemplate: true,
    playground: {
      info: '前往下载微信开发者工具',
      link:
        'https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html'
    },
  };
};
