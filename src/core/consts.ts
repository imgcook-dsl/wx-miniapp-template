import { IPanelDisplay, IDslConfig } from './interface';
export const prettierJsOpt = {
  parser: 'babel',
  printWidth: 120,
  singleQuote: true,
};
export const prettierCssOpt = {
  parser: 'css',
};

export const prettierScssOpt = {
  parser: 'scss',
  tabWidth: 2,
  printWidth: 120,
  singleQuote: true
};


export const prettierLessOpt = {
  parser: 'less',
  tabWidth: 2,
  printWidth: 120,
  singleQuote: true
};


export const prettierJsonOpt = {
  parser: 'json',
};


// output
export const prettierHtmlOpt = {
  parser: 'html',
  printWidth: 120,
  singleQuote: true
};


// 记录全局参数配置，初始化时直接修改
export let DSL_CONFIG: IDslConfig = {
  responseWidth: 750,
  scale: 1,
  cssUnit: 'rpx',
  cssStyle: 'camelCase',
  htmlFontSize: 16
};


export const initConfig = (cfg) => {
  DSL_CONFIG = Object.assign(DSL_CONFIG, cfg)
}

