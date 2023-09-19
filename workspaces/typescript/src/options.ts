import { getAbsoluteParent } from '@plugjs/plug/paths'
import ts from 'typescript'

import type { AbsolutePath } from '@plugjs/plug/paths'

/* ========================================================================== */

export type CompilerOptionsAndDiagnostics = {
  options: ts.CompilerOptions,
  errors: readonly ts.Diagnostic[],
  projectReferences?: readonly ts.ProjectReference[];
}


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
