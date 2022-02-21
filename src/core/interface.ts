
export interface IPanelDisplay {
  panelName: string;
  panelValue: string;
  panelType: string;
  folder?: string;
  mode: string;
  panelImports?: IImport[]
}

export interface IImport {
  _import: string;
  package: string;
  version: string;
}

export interface IDslConfig {
  responseWidth: number;
  scale: number;
  cssUnit: 'rpx'|'px'|'vw'|'rem';
  cssStyle: 'kebabCase' | 'camelCase' | 'snakeCase';
  outputStyle: 'component'| 'page';
  htmlFontSize: number
}