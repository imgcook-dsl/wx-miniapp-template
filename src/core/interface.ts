
export interface IPanelDisplay {
  panelName: string;
  panelValue: string;
  panelType: string;
  folder?: string;
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
  cssUnit: 'rpx';
  cssStyle: 'kebabCase' | 'camelCase' | 'snakeCase',
  htmlFontSize: number
}