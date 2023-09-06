import { getAbsoluteParent } from '@plugjs/plug/paths'
import ts from 'typescript'

import type { AbsolutePath } from '@plugjs/plug/paths'

/* ========================================================================== */

export type CompilerOptionsAndDiagnostics = {
  options: ts.CompilerOptions,
  errors: readonly ts.Diagnostic[],
}

/* ========================================================================== */

// function mergeResults(
//     base: CompilerOptionsAndDiagnostics,
//     override: CompilerOptionsAndDiagnostics,
// ): CompilerOptionsAndDiagnostics {
//   const options = { ...base.options, ...override.options }
//   const errors = [ ...base.errors, ...override.errors ]
//   return errors.length ? { options: {}, errors } : { options, errors: [] }
// }

/* ========================================================================== */

// async function loadOptions(
//     file: AbsolutePath,
//     stack: AbsolutePath[] = [ file ],
// ): Promise<CompilerOptionsAndDiagnostics> {
//   const dir = getAbsoluteParent(file)

//   // Load up our config file and convert is wicked JSON
//   const { config, error } = ts.readConfigFile(file, ts.sys.readFile)
//   if (error) return { options: {}, errors: [ error ] }

//   // Parse up the configuration file as options
//   const { compilerOptions = {}, extends: extendsPath } = config
//   const result = ts.convertCompilerOptionsFromJson(compilerOptions, dir, file)
//   if (result.errors.length) return result

//   // If we don't extend, we can return our result
//   if (!extendsPath) return result

//   // Resolve the name of the file this config extends
//   const ext = resolveAbsolutePath(dir, extendsPath)

//   // Triple check that we are not recursively importing this file
//   if (stack.includes(ext)) {
//     const data = ts.sys.readFile(file)
//     return { options: {}, errors: [ {
//       messageText: `Circularity detected extending from "${ext}"`,
//       category: ts.DiagnosticCategory.Error,
//       code: 18000, // copied from typescript internals...
//       file: ts.createSourceFile(file, data!, ts.ScriptTarget.JSON, false, ts.ScriptKind.JSON),
//       start: undefined,
//       length: undefined,
//     } ] }
//   }

//   // Push our file in the stack and load recursively
//   return mergeResults(await loadOptions(ext, [ ...stack, ext ]), result)
// }

/* ========================================================================== */

// export async function getCompilerOptions(
//   file?: AbsolutePath,
// ): Promise<CompilerOptionsAndDiagnostics>

// export async function getCompilerOptions(
//   file: AbsolutePath | undefined,
//   overrides: ts.CompilerOptions,
//   inputs: AbsolutePath[],
// ): Promise<CompilerOptionsAndDiagnostics>

/** Load compiler options from a JSON file, and merge in the overrides */
export async function getCompilerOptions(
    file: AbsolutePath | undefined,
    overrides: ts.CompilerOptions,
    inputs: AbsolutePath[],
): Promise<CompilerOptionsAndDiagnostics> {
  // If we don't have a config file, return the merged defaults/overrides
  if (! file) {
    const options = { ...ts.getDefaultCompilerOptions(), ...overrides }
    return { options, errors: [] }
  }

  // Our config parser host
  const host: ts.ParseConfigHost = {
    useCaseSensitiveFileNames: ts.sys.useCaseSensitiveFileNames,
    readDirectory(rootDir, extensions, excludes, includes, depth): readonly string[] {
      return ts.sys.readDirectory(rootDir, extensions, excludes, includes, depth)
    },
    fileExists(path: string): boolean {
      return ts.sys.fileExists(path)
    },
    readFile(path: string): string | undefined {
      return ts.sys.readFile(path)
    },
  }

  // The "readJsonConfigFile" / "parseJsonSourceFileConfigFileContent" migth
  // be better here, but "readJsonConfigFile" doesn't return any errors in
  // case a file doesn't exist, and "parseJsonSourceFileConfigFileContent"
  // then fails miserably as it can't really find anything in the source
  const { config, error } = ts.readConfigFile(file, ts.sys.readFile)
  if (error) return { options: {}, errors: [ error ] }

  // Inputs will be discarded, but are needed by "parseJsonConfigFileConent"
  // otherwise it'll complain that we have no inputs in the "tsconfig.json"
  config.include = inputs

  return ts.parseJsonConfigFileContent(
      config, // the parsed JSON
      host, // our config parser host
      getAbsoluteParent(file), // directory for path resolution
      overrides, // overrides (from the TSC plug config)
      file, // the file name for path resolution
  )
}
