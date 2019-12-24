const co = require('co');
const fs = require('fs-extra');
const path = require('path');
const prettier = require('prettier');
const {NodeVM} = require('vm2');
const _ = require('lodash');
const dslHelper = require('@imgcook/dsl-helper');
const newSchema = require('./newSchema');
const vm = new NodeVM({
  console: 'inherit',
  sandbox: {}
});
co(function*() {
  const code = fs.readFileSync(path.resolve(__dirname, '../src/index.js'), 'utf8');
  const renderInfo = vm.run(code)(newSchema, {
    prettier: prettier,
    _: _,
    helper: dslHelper,
  });
  const { wxml, wxss, js, json } = renderInfo.renderData;
  fs.ensureDirSync(path.resolve(__dirname, './component'));
  fs.writeFileSync(path.join(__dirname, './component/component.wxml'), wxml);
  fs.writeFileSync(path.join(__dirname, './component/component.wxss'), wxss);
  fs.writeFileSync(path.join(__dirname, './component/component.js'), js);
  fs.writeFileSync(path.join(__dirname, './component/component.json'), json);
});