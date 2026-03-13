import * as fs from 'node:fs';
import * as path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

type JsDocViolation = {
  file: string;
  line: number;
  message: string;
};

const ROOT = path.resolve(__dirname, '..');
const PACKAGES_DIR = path.join(ROOT, 'packages');

/**
 * Recursively collect all .ts files under a directory.
 * @param dir - Directory to scan
 * @returns Array of absolute file paths
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      results.push(full);
    }
  }

  return results;
}

/**
 * Check whether a node is exported from its source file.
 * @param node - The declaration node
 * @returns true when the node has an export modifier
 */
function isExported(node: ts.Node): boolean {
  const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

/**
 * Check whether a class member is externally callable.
 * @param member - The class member node
 * @returns true for public/protected-by-default methods and accessors
 */
function isDocumentedMember(member: ts.ClassElement): boolean {
  const modifiers = ts.canHaveModifiers(member) ? ts.getModifiers(member) : undefined;
  const isPrivate = modifiers?.some(
    (modifier) =>
      modifier.kind === ts.SyntaxKind.PrivateKeyword ||
      modifier.kind === ts.SyntaxKind.ProtectedKeyword,
  );

  return !isPrivate;
}

/**
 * Collect JSDoc blocks attached to a node.
 * @param node - The declaration node
 * @returns Attached JSDoc blocks
 */
function getJsDocBlocks(node: ts.Node): ts.JSDoc[] {
  return ts.getJSDocCommentsAndTags(node).filter(ts.isJSDoc);
}

/**
 * Resolve the source line for a node.
 * @param sourceFile - The owning source file
 * @param node - The node to locate
 * @returns 1-based line number
 */
function getLine(sourceFile: ts.SourceFile, node: ts.Node): number {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

/**
 * Normalize a function parameter for JSDoc matching.
 * @param parameter - The parameter declaration
 * @returns JSDoc name or null when matching is ambiguous
 */
function getParameterName(parameter: ts.ParameterDeclaration): string | null {
  return ts.isIdentifier(parameter.name) ? parameter.name.text : null;
}

/**
 * Return the JSDoc tag names attached to a node.
 * @param node - The declaration node
 * @returns Param tag names and whether a returns tag exists
 */
function getJsDocTagInfo(node: ts.Node): { paramNames: Set<string>; hasReturns: boolean } {
  const paramNames = new Set<string>();
  let hasReturns = false;

  for (const tag of ts.getJSDocTags(node)) {
    if (tag.tagName.text === 'param') {
      const name = tag.name?.getText();
      if (name) paramNames.add(name);
    }
    if (tag.tagName.text === 'returns' || tag.tagName.text === 'return') {
      hasReturns = true;
    }
  }

  return { paramNames, hasReturns };
}

/**
 * Determine whether a callable requires an `@returns` tag.
 * @param node - Function-like declaration
 * @returns true when a return value should be documented
 */
function requiresReturnsTag(node: ts.SignatureDeclarationBase): boolean {
  if (!node.type) return true;
  if (
    node.type.kind === ts.SyntaxKind.VoidKeyword ||
    node.type.kind === ts.SyntaxKind.NeverKeyword
  ) {
    return false;
  }

  if (
    ts.isTypeReferenceNode(node.type) &&
    ts.isIdentifier(node.type.typeName) &&
    node.type.typeName.text === 'Promise' &&
    node.type.typeArguments?.length === 1
  ) {
    const [innerType] = node.type.typeArguments;
    if (
      innerType.kind === ts.SyntaxKind.VoidKeyword ||
      innerType.kind === ts.SyntaxKind.NeverKeyword
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Check a function-like declaration for required tags.
 * @param sourceFile - The owning source file
 * @param node - The callable declaration
 * @param label - Human-readable declaration name
 * @returns JSDoc violations
 */
function validateCallable(
  sourceFile: ts.SourceFile,
  node: ts.SignatureDeclarationBase,
  label: string,
): JsDocViolation[] {
  const violations: JsDocViolation[] = [];
  const docs = getJsDocBlocks(node);
  const line = getLine(sourceFile, node);

  if (docs.length === 0) {
    violations.push({
      file: sourceFile.fileName,
      line,
      message: `${label} is missing a JSDoc block`,
    });
    return violations;
  }

  const { paramNames, hasReturns } = getJsDocTagInfo(node);
  for (const parameter of node.parameters) {
    const name = getParameterName(parameter);
    if (name && !paramNames.has(name)) {
      violations.push({
        file: sourceFile.fileName,
        line,
        message: `${label} is missing @param for "${name}"`,
      });
    }
  }

  if (requiresReturnsTag(node) && !hasReturns) {
    violations.push({
      file: sourceFile.fileName,
      line,
      message: `${label} is missing @returns`,
    });
  }

  return violations;
}

/**
 * Check that a declaration has a JSDoc block.
 * @param sourceFile - The owning source file
 * @param node - The declaration to validate
 * @param label - Human-readable declaration name
 * @returns Zero or one JSDoc violations
 */
function validateDeclarationDoc(
  sourceFile: ts.SourceFile,
  node: ts.Node,
  label: string,
): JsDocViolation[] {
  if (getJsDocBlocks(node).length > 0) return [];

  return [
    {
      file: sourceFile.fileName,
      line: getLine(sourceFile, node),
      message: `${label} is missing a JSDoc block`,
    },
  ];
}

/**
 * Scan a source file for exported declaration JSDoc violations.
 * @param sourceFile - Parsed TypeScript source file
 * @returns All violations in the file
 */
function collectViolations(sourceFile: ts.SourceFile): JsDocViolation[] {
  const violations: JsDocViolation[] = [];

  for (const statement of sourceFile.statements) {
    if (!isExported(statement)) continue;

    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text ?? 'default function';
      violations.push(...validateCallable(sourceFile, statement, `function ${name}`));
      continue;
    }

    if (ts.isClassDeclaration(statement)) {
      const className = statement.name?.text ?? 'default class';
      violations.push(...validateDeclarationDoc(sourceFile, statement, `class ${className}`));

      for (const member of statement.members) {
        if (!isDocumentedMember(member)) continue;

        if (ts.isMethodDeclaration(member)) {
          const memberName = member.name.getText(sourceFile);
          violations.push(
            ...validateCallable(sourceFile, member, `method ${className}.${memberName}`),
          );
          continue;
        }

        if (ts.isGetAccessorDeclaration(member)) {
          const memberName = member.name.getText(sourceFile);
          const docs = getJsDocBlocks(member);
          if (docs.length === 0) {
            violations.push({
              file: sourceFile.fileName,
              line: getLine(sourceFile, member),
              message: `getter ${className}.${memberName} is missing a JSDoc block`,
            });
            continue;
          }

          const { hasReturns } = getJsDocTagInfo(member);
          if (!hasReturns) {
            violations.push({
              file: sourceFile.fileName,
              line: getLine(sourceFile, member),
              message: `getter ${className}.${memberName} is missing @returns`,
            });
          }
          continue;
        }

        if (ts.isSetAccessorDeclaration(member)) {
          const memberName = member.name.getText(sourceFile);
          violations.push(
            ...validateCallable(sourceFile, member, `setter ${className}.${memberName}`),
          );
        }
      }

      continue;
    }

    if (ts.isInterfaceDeclaration(statement)) {
      violations.push(
        ...validateDeclarationDoc(sourceFile, statement, `interface ${statement.name.text}`),
      );
      continue;
    }

    if (ts.isTypeAliasDeclaration(statement)) {
      violations.push(
        ...validateDeclarationDoc(sourceFile, statement, `type ${statement.name.text}`),
      );
    }
  }

  return violations;
}

describe('JSDoc hygiene', () => {
  it('exported declarations and class callables have required JSDoc coverage', () => {
    const packages = fs.readdirSync(PACKAGES_DIR, { withFileTypes: true });
    const violations: string[] = [];

    for (const pkg of packages) {
      if (!pkg.isDirectory()) continue;

      const srcDir = path.join(PACKAGES_DIR, pkg.name, 'src');
      const files = collectTsFiles(srcDir);

      for (const file of files) {
        const sourceFile = ts.createSourceFile(
          file,
          fs.readFileSync(file, 'utf-8'),
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TS,
        );

        for (const violation of collectViolations(sourceFile)) {
          violations.push(
            `${path.relative(ROOT, violation.file)}:${violation.line} - ${violation.message}`,
          );
        }
      }
    }

    expect(
      violations,
      `JSDoc coverage violations:\n  ${violations.join('\n  ')}\n` +
        'Add a JSDoc block to exported declarations and ensure exported callables ' +
        'document parameters with @param and return values with @returns.',
    ).toHaveLength(0);
  });
});
