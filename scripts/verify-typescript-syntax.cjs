const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const candidates = [
  path.join(frontendRoot, 'node_modules', 'typescript'),
  process.env.TYPESCRIPT_MODULE_PATH,
  '/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript',
].filter(Boolean);

let typescript;
for (const candidate of candidates) {
  try {
    typescript = require(candidate);
    break;
  } catch (_error) {
    // Try the next candidate.
  }
}
if (!typescript) {
  try {
    typescript = require('typescript');
  } catch (_error) {
    console.error('[FAIL] TypeScript 모듈을 찾을 수 없습니다. frontend에서 npm install 후 다시 실행하세요.');
    process.exit(2);
  }
}

const sourceRoot = path.join(frontendRoot, 'src');
const sourceFiles = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const completePath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(completePath);
    else if (/\.(ts|tsx)$/.test(entry.name)) sourceFiles.push(completePath);
  }
};
walk(sourceRoot);

let syntaxErrorCount = 0;
for (const sourceFilePath of sourceFiles) {
  const sourceText = fs.readFileSync(sourceFilePath, 'utf8');
  const scriptKind = sourceFilePath.endsWith('.tsx')
    ? typescript.ScriptKind.TSX
    : typescript.ScriptKind.TS;
  const sourceFile = typescript.createSourceFile(
    sourceFilePath,
    sourceText,
    typescript.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  for (const diagnostic of sourceFile.parseDiagnostics) {
    syntaxErrorCount += 1;
    const position = sourceFile.getLineAndCharacterOfPosition(diagnostic.start ?? 0);
    console.error(
      `[FAIL] ${path.relative(projectRoot, sourceFilePath)}:${position.line + 1}:${position.character + 1} `
      + typescript.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
    );
  }
}

if (syntaxErrorCount > 0) process.exit(1);
console.log(`[PASS] TypeScript/TSX syntax: ${sourceFiles.length} files`);
