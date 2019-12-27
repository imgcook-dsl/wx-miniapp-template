const co = require('co');
const fs = require('fs-extra');
const path = require('path');

const prettier = require('prettier');
const _ = require('lodash');
const helper = require('@imgcook/dsl-helper');

const { NodeVM } = require('vm2');
const vm = new NodeVM({
  console: 'inherit',
  sandbox: {}
});
const schema = require('./schema');

co(function*() {
  const code = fs.readFileSync(
    path.resolve(__dirname, '../src/index.js'),
    'utf8'
  );
  const renderInfo = vm.run(code)(schema, {
    prettier,
    _,
    helper
  });
  const panelDisplay = renderInfo.panelDisplay;
  fs.ensureDirSync(path.resolve(__dirname, '../code'));
  panelDisplay.map(item => {
    const { panelValue, panelName } = item;
    fs.writeFileSync(path.join(__dirname, `../code/${panelName}`), panelValue);
  });
});
