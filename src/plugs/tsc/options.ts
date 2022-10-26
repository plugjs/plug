import ts from 'typescript' // TypeScript does NOT support ESM modules

import { AbsolutePath, getAbsoluteParent, resolveAbsolutePath } from '../../paths'
import { readFile } from '../../utils/asyncfs'

/* ========================================================================== */

export type CompilerOptionsAndDiagnostics = {
  options: ts.CompilerOptions,
  errors: readonly ts.Diagnostic[],
}

/* ========================================================================== */

function mergeResults(
    base: CompilerOptionsAndDiagnostics,
    override: CompilerOptionsAndDiagnostics,
): CompilerOptionsAndDiagnostics {
  return {
    options: { ...base.options, ...override.options },
    errors: [ ...base.errors, ...override.errors ],
  }
}

/* ========================================================================== */

async function loadOptions(
    file: AbsolutePath,
    stack: AbsolutePath[] = [ file ],
): Promise<CompilerOptionsAndDiagnostics> {
  const dir = getAbsoluteParent(file)

  // Load up our config file and convert is wicked JSON
  const data = await readFile(file, 'utf-8')
  const { config, error } = ts.parseConfigFileTextToJson(file, data)
  if (error) return { options: {}, errors: [ error ] }

  // Parse up the configuration file as options
  const { compilerOptions = {}, extends: extendsPath } = config
  const result = ts.convertCompilerOptionsFromJson(compilerOptions, dir, file)
  if (result.errors.length) return result

  // If we don't extend, we can return our result
  if (!extendsPath) return result

  // Resolve the name of the file this config extends
  const ext = resolveAbsolutePath(dir, extendsPath)

  // Triple check that we are not recursively importing this file
  if (stack.includes(ext)) {
    return { options: {}, errors: [ {
      messageText: `Circularity detected extending from "${ext}"`,
      category: ts.DiagnosticCategory.Error,
      code: 18000, // copied from typescript internals...
      file: ts.createSourceFile(file, data, ts.ScriptTarget.JSON, false, ts.ScriptKind.JSON),
      start: undefined,
      length: undefined,
    } ] }
  }

  // Push our file in the stack and load recursively
  return mergeResults(await loadOptions(ext, [ ...stack, ext ]), result)
}

/* ========================================================================== */

export async function getCompilerOptions(
  file?: AbsolutePath,
): Promise<CompilerOptionsAndDiagnostics>

export async function getCompilerOptions(
  file: AbsolutePath | undefined,
  overrides: ts.CompilerOptions,
  overridesFile: AbsolutePath,
  overridesBasePath: AbsolutePath,
): Promise<CompilerOptionsAndDiagnostics>

/** Load compiler options from a JSON file, and merge in the overrides */
export async function getCompilerOptions(
    file?: AbsolutePath,
    ...override: [ ts.CompilerOptions, AbsolutePath, AbsolutePath ] | []
): Promise<CompilerOptionsAndDiagnostics> {
  let result: CompilerOptionsAndDiagnostics = { options: ts.getDefaultCompilerOptions(), errors: [] }

  // If we have a file to parse, load it, otherwise try "tsconfig.json"
  if (file) result = mergeResults(result, await loadOptions(file))

  // If we have overrides, merge them
  if (override.length) {
    const [ overrides, overridesFile, overridesDir ] = override
    const options = ts.convertCompilerOptionsFromJson(overrides, overridesDir, overridesFile)
    delete options.options.configFilePath // remove build file name...
    result = mergeResults(result, options)
  }

  // Return all we have
  return result
}
