// Cucumber runner config — Issue #1
//
// Las acceptance.feature vienen del submódulo de docs (`tacosmanager-docs`).
// Cada Escenario lleva un tag @REQ-NNNN que se trazan en docs/traceability.md.
//
// Reqs cubiertos en este archivo: paths apuntan a docs/specs/**/acceptance.feature
// para que el runner descubra los 38 REQ-IDs vigentes en el ecosistema.

// El tsconfig del repo usa `module: nodenext`, que no es compatible con
// la carga directa desde cucumber. Override transparente solo para ts-node.
process.env.TS_NODE_TRANSPILE_ONLY = process.env.TS_NODE_TRANSPILE_ONLY ?? 'true';
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: 'CommonJS',
  moduleResolution: 'node',
  target: 'ES2022',
  esModuleInterop: true,
  experimentalDecorators: true,
  emitDecoratorMetadata: true,
  resolveJsonModule: true,
  resolvePackageJsonExports: false,
  strictNullChecks: true,
  noImplicitAny: false,
  skipLibCheck: true,
});

module.exports = {
  default: {
    paths: ['docs/specs/**/acceptance.feature'],
    require: ['test/features/**/*.ts'],
    requireModule: ['ts-node/register'],
    format: [
      'progress-bar',
      'summary',
      'json:reports/cucumber.json',
      'html:reports/cucumber.html',
    ],
    formatOptions: { snippetInterface: 'async-await' },
    publishQuiet: true,
    failFast: false,
    defaultTimeout: 30000,
  },
};
