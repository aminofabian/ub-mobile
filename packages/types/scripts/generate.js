const { execSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '../../../..');
const backend = path.join(root, 'backend');
const outputDir = path.resolve(__dirname, '../src/generated');

const specs = [
  {
    input: path.join(backend, 'docs/openapi/phase-1.yaml'),
    output: path.join(outputDir, 'phase-1.ts'),
  },
  {
    input: path.join(backend, 'docs/openapi/phase-15-storefront-public.yaml'),
    output: path.join(outputDir, 'phase-15-storefront-public.ts'),
  },
];

for (const spec of specs) {
  console.log(`Generating types from ${spec.input}...`);
  execSync(`npx openapi-typescript ${spec.input} -o ${spec.output}`, {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
  });
}

const fs = require('fs');

const indexPath = path.join(outputDir, 'index.ts');
const indexExports = specs
  .map((spec) => {
    const name = path.basename(spec.output, '.ts');
    const namespace = name
      .replace(/-/g, '_')
      .replace(/^(\d)/, '_$1');
    return `export * as ${namespace} from './${name}';`;
  })
  .join('\n');

fs.writeFileSync(indexPath, indexExports + '\n');
console.log('Done. Types written to src/generated/');
