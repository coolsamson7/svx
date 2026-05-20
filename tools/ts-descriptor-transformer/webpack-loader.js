const ts = require('typescript');
const { before } = require('./dist/index.js');

const TRIGGERS = ['Reflectable', 'DeclareService', 'DeclareComponent'];
const TRIGGER_PATTERN = new RegExp(TRIGGERS.join('|'));

module.exports = function (source) {
  if (!TRIGGER_PATTERN.test(source)) return source;

  const sourceFile = ts.createSourceFile(this.resourcePath, source, ts.ScriptTarget.ES2019, true);
  const fakeProgram = { getTypeChecker: () => ({}) };
  const result = ts.transform(sourceFile, [before({ decorators: TRIGGERS }, fakeProgram)]);
  return ts.createPrinter().printFile(result.transformed[0]);
};
