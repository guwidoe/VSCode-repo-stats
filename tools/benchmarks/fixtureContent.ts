export const TEXT_FILE_VARIANTS = [
  { extension: '.ts', directory: 'src/core', lines: (i: number) => [
    `export function feature${i}(input: number): number {`,
    `  return input + ${i};`,
    '}',
  ] },
  { extension: '.tsx', directory: 'src/ui', lines: (i: number) => [
    `export function Card${i}() {`,
    `  return <section data-card="${i}">Card ${i}</section>;`,
    '}',
  ] },
  { extension: '.js', directory: 'scripts', lines: (i: number) => [
    `function task${i}() {`,
    `  return 'task-${i}';`,
    '}',
    `module.exports = { task${i} };`,
  ] },
  { extension: '.json', directory: 'config', lines: (i: number) => [
    '{',
    `  "name": "config-${i}",`,
    `  "enabled": ${i % 2 === 0 ? 'true' : 'false'}`,
    '}',
  ] },
  { extension: '.md', directory: 'docs', lines: (i: number) => [
    `# Document ${i}`,
    '',
    `Generated benchmark note ${i}.`,
  ] },
  { extension: '.css', directory: 'styles', lines: (i: number) => [
    `.card-${i} {`,
    `  padding: ${(i % 6) + 4}px;`,
    '}',
  ] },
  { extension: '.yml', directory: '.github/workflows', lines: (i: number) => [
    `name: workflow-${i}`,
    'on: [push]',
    'jobs:',
    '  check:',
    '    runs-on: ubuntu-latest',
  ] },
];

export function buildInitialTextFile(relativePath: string, fileIndex: number): string[] {
  const variant = TEXT_FILE_VARIANTS[fileIndex % TEXT_FILE_VARIANTS.length];
  return [
    ...variant.lines(fileIndex),
    '',
    `// benchmark-file: ${relativePath}`,
  ];
}

export function buildMutationBlock(
  commitIndex: number,
  mutationIndex: number,
  lines: number
): string[] {
  const block: string[] = [`// mutation ${commitIndex}-${mutationIndex}`];
  for (let index = 0; index < lines; index += 1) {
    block.push(
      `export const benchmark_${commitIndex}_${mutationIndex}_${index} = ${commitIndex + mutationIndex + index};`
    );
  }
  return block;
}
