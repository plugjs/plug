import { fileURLToPath, pathToFileURL } from 'node:url'

import { SourceMapConsumer } from 'source-map'

import { assert } from '../../assert'
import { $gry, $p } from '../../log'
import { readFile } from '../../fs'

import type { Logger } from '../../log'
import type { RawSourceMap } from 'source-map'
import type { AbsolutePath } from '../../paths'

/* ========================================================================== *
 * V8 COVERAGE TYPES                                                          *
 * ========================================================================== */

/** Coverage range */
export interface V8CoveredRange {
  /** The offset in the script of the first character covered */
  startOffset: number,
  /** The offset (exclusive) in the script of the last character covered */
  endOffset: number,
  /** The number of times the specified offset was covered */
  count: number,
}

/** Coverage report per function as invoked by Node */
export interface V8CoveredFunction {
  /** The name of the function being covered */
  functionName: string,
  /** A flag indicating whether fine-grained (precise) coverage is available */
  isBlockCoverage: boolean,
  /**
   * The ranges covered.
   *
   * The first range indicates the whole function.
   */
  ranges: V8CoveredRange[],
}

/** Coverage result for a particlar script as seen by Node */
export interface V8CoverageResult {
  /** The script ID, uniquely identifying the script within the Node process */
  scriptId: string,
  /** The URL of the script (might not be unique, if the script is loaded multiple times) */
  url: string,
  /** Per-function report of coverage */
  functions: V8CoveredFunction[]
}

/** Cached source map for a coverage result */
export interface V8SourceMapCache {
  /** The line lengths (sans EOL) in the transpiled code */
  lineLengths: number[],
  /** The source map associated with the transpiled code */
  data: RawSourceMap | null,
  /** The url (if any) of the sourcemap, for resolving relative paths */
  url: string | null,
}

/** The RAW coverage data as emitted by Node, parsed from JSON */
export interface V8CoverageData {
  /**
   * Coverage results, per script.
   *
   * The first element in the array describes the coverage for the whole script.
   */
  'result': V8CoverageResult[],
  /** Timestamp when coverage was taken */
  'timestamp'?: number,
  /** Source maps caches keyed by `result[?].url` */
  'source-map-cache'?: Record<string, V8SourceMapCache>
}

/* ========================================================================== *
 * COVERAGE ANALYSIS                                                          *
 * ========================================================================== */

/**
 * The bias for source map analisys (defaults to `least_upper_bound`).
 *
 * We use `least_upper_bound` here, as it's the _opposite_ of the default
 * `greatest_lower_bound`, and we _reverse_ the lookup of the sourcemaps (from
 * source code to generated code).
 */
export type SourceMapBias = 'greatest_lower_bound' | 'least_upper_bound' | 'none' | undefined

/** Interface providing coverage data */
export interface CoverageAnalyser {
  /** Return the number of coverage passes for the given location */
  coverage(source: string, line: number, column: number): number
  /** Destroy this instance */
  destroy(): void
}

/* ========================================================================== */

/** Basic abstract class implementing the {@link CoverageAnalyser} class */
abstract class CoverageAnalyserImpl implements CoverageAnalyser {
  constructor(protected readonly _log: Logger) {}

  abstract init(): Promise<this>
  abstract destroy(): void
  abstract coverage(source: string, line: number, column: number): number
}


/* ========================================================================== */

/** Return coverage data from a V8 {@link V8CoverageResult} structure */
class CoverageResultAnalyser extends CoverageAnalyserImpl {
  /** Number of passes at each character in the result */
  protected readonly _coverage: readonly (number | undefined)[]
  /** Internal private field for init/_lineLengths getter */
  protected _lineLengths?: readonly number[]

  constructor(
      log: Logger,
      protected readonly _result: V8CoverageResult,
  ) {
    super(log)

    const _coverage: (number | undefined)[] = []

    for (const coveredFunction of _result.functions) {
      for (const range of coveredFunction.ranges) {
        for (let i = range.startOffset; i < range.endOffset; i ++) {
          _coverage[i] = range.count
        }
      }
    }

    this._coverage = _coverage
  }

  async init(): Promise<this> {
    const filename = fileURLToPath(this._result.url)
    const source = await readFile(filename, 'utf-8')
    this._lineLengths = source.split('\n').map((line) => line.length)
    return this
  }

  destroy(): void {
    // Nothing to do
  }

  /** Return the number of coverage passes for the given location */
  coverage(source: string, line: number, column: number): number {
    assert(this._lineLengths, 'Analyser not initialized')
    assert(source === this._result.url, `Wrong source ${source} (should be ${this._result.url})`)

    const { _lineLengths, _coverage } = this
    let offset = 0

    /* Calculate the offset at the beginning of the line */
    for (let l = line - 2; l >= 0; l--) offset += _lineLengths[l]! + 1

    /* Return the number of passes from the coverage data */
    return _coverage[offset + column] || 0
  }
}

/* ========================================================================== */

/** Return coverage from a V8 {@link V8CoverageResult} with a sitemap */
class CoverageSitemapAnalyser extends CoverageResultAnalyser {
  private _preciseMappings = new Map<string, { line: number, column: number }>()
  private _sourceMap?: SourceMapConsumer

  constructor(
      log: Logger,
      result: V8CoverageResult,
      private readonly _sourceMapCache: V8SourceMapCache,
      private readonly _sourceMapBias: SourceMapBias,
  ) {
    super(log, result)
    this._lineLengths = _sourceMapCache.lineLengths
  }

  private _key(source: string, line: number, column: number): string {
    return `${line}:${column}:${source}`
  }

  async init(): Promise<this> {
    const sourceMap = this._sourceMapCache.data
    assert(sourceMap, 'Missing source map data from cache')
    this._sourceMap = await new SourceMapConsumer(sourceMap)

    if (this._sourceMapBias === 'none') {
      this._sourceMap.eachMapping((m) => {
        const location = { line: m.generatedLine, column: m.generatedColumn }
        const key = this._key(m.source, m.originalLine, m.originalColumn)
        this._preciseMappings.set(key, location)
      })
    }

    return this
  }

  destroy(): void {
    this._sourceMap?.destroy()
  }

  coverage(source: string, line: number, column: number): number {
    assert(this._sourceMap, 'Analyser not initialized')

    if (this._sourceMapBias === 'none') {
      const key = this._key(source, line, column)
      const location = this._preciseMappings.get(key)
      if (! location) {
        this._log.debug(`No precise mapping for ${source}:${line}:${column}`)
        return 0
      } else {
        return super.coverage(this._result.url, location.line, location.column)
      }
    }

    const bias =
      this._sourceMapBias === 'greatest_lower_bound' ? SourceMapConsumer.GREATEST_LOWER_BOUND :
      this._sourceMapBias === 'least_upper_bound' ? SourceMapConsumer.LEAST_UPPER_BOUND :
      undefined

    const generated = this._sourceMap.generatedPositionFor({ source, line, column, bias })

    if (! generated) {
      this._log.debug(`No position generated for ${source}:${line}:${column}`)
      return 0
    }

    if (generated.line == null) {
      this._log.debug(`No line generated for ${source}:${line}:${column}`)
      return 0
    }

    if (generated.column == null) {
      this._log.debug(`No column generated for ${source}:${line}:${column}`)
      return 0
    }

    return super.coverage(this._result.url, generated.line, generated.column)
  }
}

/* ========================================================================== */

/** Combine (add) all coverage data from all analysers */
function combineCoverage(
    analysers: Set<CoverageAnalyser> | undefined,
    source: string,
    line: number,
    column: number,
): number {
  let coverage = 0

  if (! analysers) return coverage

  for (const analyser of analysers) {
    coverage += analyser.coverage(source, line, column)
  }

  return coverage
}

/* ========================================================================== */

/** Associate one or more {@link CoverageAnalyser} with different sources */
export class SourcesCoverageAnalyser extends CoverageAnalyserImpl {
  private readonly _mappings = new Map<string, Set<CoverageAnalyserImpl>>()

  constructor(log: Logger, private readonly _filename: AbsolutePath) {
    super(log)
  }

  hasMappings(): boolean {
    return this._mappings.size > 0
  }

  add(source: string, analyser: CoverageAnalyserImpl): void {
    const analysers = this._mappings.get(source) || new Set()
    analysers.add(analyser)
    this._mappings.set(source, analysers)
  }

  async init(): Promise<this> {
    this._log.debug('SourcesCoverageAnalyser', $p(this._filename), $gry(`(${this._mappings.size} mappings)`))
    for (const analysers of this._mappings.values()) {
      for (const analyser of analysers) {
        await analyser.init()
      }
    }
    return this
  }

  destroy(): void {
    for (const analysers of this._mappings.values()) {
      for (const analyser of analysers) {
        analyser.destroy()
      }
    }
  }

  coverage(source: string, line: number, column: number): number {
    const analysers = this._mappings.get(source)
    return combineCoverage(analysers, source, line, column)
  }
}

/** Combine multiple {@link CoverageAnalyser} instances together */
export class CombiningCoverageAnalyser extends CoverageAnalyserImpl {
  private readonly _analysers = new Set<CoverageAnalyserImpl>()

  add(analyser: CoverageAnalyserImpl): void {
    this._analysers.add(analyser)
  }

  async init(): Promise<this> {
    this._log.debug('CombiningCoverageAnalyser', $gry(`(${this._analysers.size} analysers)`))
    this._log.enter()
    try {
      for (const analyser of this._analysers) await analyser.init()
      return this
    } finally {
      this._log.leave()
    }
  }

  destroy(): void {
    for (const analyser of this._analysers) analyser.destroy()
  }

  coverage(source: string, line: number, column: number): number {
    return combineCoverage(this._analysers, source, line, column)
  }
}

/* ========================================================================== */

/**
 * Analyse coverage for the specified source files, using the data from the
 * specified coverage files and produce a {@link CoverageReport}.
 */
export async function createAnalyser(
    sourceFiles: AbsolutePath[],
    coverageFiles: AbsolutePath[],
    sourceMapBias: SourceMapBias,
    log: Logger,
): Promise<CoverageAnalyser> {
  /* Internally V8 coverage uses URLs for everything */
  const urls = sourceFiles.map((path) => pathToFileURL(path).toString())

  /* The coverage analyser combining all coverage files in the directory */
  const analyser = new CombiningCoverageAnalyser(log)

  /* Resolve and walk the coverage directory, finding "coverage-*.json" files */
  for await (const coverageFile of coverageFiles) {
    /* The "SourceCoverageAnalyser" for this coverage file */
    const coverageFileAnalyser = new SourcesCoverageAnalyser(log, coverageFile)

    /* Parse our coverage file from JSON */
    log.info('Parsing coverage file', $p(coverageFile))
    const contents = await readFile(coverageFile, 'utf-8')
    const coverage: V8CoverageData = JSON.parse(contents)

    /* Let's look inside of the coverage file... */
    for (const result of coverage.result) {
      /*
        * Each coverage result (script) can be associated with a sitemap or
        * not... Sometimes (as in with ts-node) the sitemap simply points to
        * itself (same file), but embeds all the transformation information
        * between the file on disk, and what's been used by Node.JS.
        */
      const mapping = coverage['source-map-cache']?.[result.url]
      if (mapping) {
        /*
          * If we have mapping, we want to see if any of the sourcemap's source
          * files matches one of the sources we have to analyse.
          */
        const matches = urls.filter((url) => mapping.data?.sources.includes(url))

        /* If we map any file, we associate it with our source map analyser */
        if (matches.length) {
          const sourceAnalyser = new CoverageSitemapAnalyser(log, result, mapping, sourceMapBias)
          for (const match of matches) coverageFileAnalyser.add(match, sourceAnalyser)
        }

      /*
        * If we have no source map for the file, but it matches one of the
        * ones we have to analyse coverage for, we add that directly...
        */
      } else if (urls.includes(result.url)) {
        coverageFileAnalyser.add(result.url, new CoverageResultAnalyser(log, result))
      }
    }

    /* Add the analyser if it has some mappings */
    if (coverageFileAnalyser.hasMappings()) analyser.add(coverageFileAnalyser)
  }

  return await analyser.init()
}
