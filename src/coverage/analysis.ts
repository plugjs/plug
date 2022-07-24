import assert from 'assert'
import fs from '../utils/asyncfs'

import { fileURLToPath } from 'url'
import { log } from '../log'
import { RawSourceMap } from 'source-map'
import { SourceMapConsumer } from 'source-map'

/* ========================================================================== *
 * V8 COVERAGE TYPES                                                          *
 * ========================================================================== */

/** Coverage range */
export interface CoveredRange {
  /** The offset in the script of the first character covered */
  startOffset: number,
  /** The offset (exclusive) in the script of the last character covered */
  endOffset: number,
  /** The number of times the specified offset was covered */
  count: number,
}

/** Coverage report per function as invoked by Node */
export interface CoveredFunction {
  /** The name of the function being covered */
  functionName: string,
  /** A flag indicating whether fine-grained (precise) coverage is available */
  isBlockCoverage: boolean,
  /**
   * The ranges covered.
   *
   * The first range indicates the whole function.
   */
  ranges: CoveredRange[],
}

/** Coverage result for a particlar script as seen by Node */
export interface CoverageResult {
  /** The script ID, uniquely identifying the script within the Node process */
  scriptId: string,
  /** The URL of the script (might not be unique, if the script is loaded multiple times) */
  url: string,
  /** Per-function report of coverage */
  functions: CoveredFunction[]
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
  'result': CoverageResult[],
  /** Timestamp when coverage was taken */
  'timestamp': number,
  /** Source maps caches keyed by `result[?].url` */
  'source-map-cache': Record<string, V8SourceMapCache>
}

/* ========================================================================== *
 * COVERAGE ANALYSIS                                                          *
 * ========================================================================== */

/** Interface providing coverage data */
export interface CoverageAnalyser {
  /** Asynchronously initialize this instance */
  init(): Promise<void>
  /** Asynchronously destroy this instance */
  destroy(): Promise<void>
  /** Return the number of coverage passes for the given location */
  coverage(source: string, line: number, column: number): number
}

/* ========================================================================== */

/** Return coverage data from a V8 {@link CoverageResult} structure */
export class CoverageResultAnalyser implements CoverageAnalyser {
  /** Number of passes at each character in the result */
  protected readonly _coverage: readonly (number | undefined)[]
  /** Internal private field for init/_lineLengths getter */
  #lineLengths?: readonly number[]

  constructor(protected readonly _result: CoverageResult) {
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

  async init(): Promise<void> {
    const filename = fileURLToPath(this._result.url)
    const source = await fs.readFile(filename, 'utf-8')
    this.#lineLengths = source.split('\n').map((line) => line.length)
  }

  async destroy(): Promise<void> {
    // Nothing to do
  }

  /** Length of each line in the original source file */
  protected get _lineLengths(): readonly number[] {
    assert (this.#lineLengths, 'Analyser not initialized')
    return this.#lineLengths
  }

  /** Return the number of coverage passes for the given location */
  coverage(source: string, line: number, column: number): number {
    assert(source === this._result.url, `Wrong source ${source} (should be ${this._result.url})`)

    const { _lineLengths, _coverage } = this
    let offset = 0

    /* Calculate the offset at the beginning of the line */
    for (let l = line - 2; l >= 0; l--) offset += _lineLengths[l] + 1

    /* Return the number of passes from the coverage data */
    return _coverage[offset + column] || 0
  }
}

/* ========================================================================== */

/** Return coverage from a V8 {@link CoverageResult} with a sitemap */
export class CoverageSitemapAnalyser extends CoverageResultAnalyser {
  #sourceMap?: SourceMapConsumer

  constructor(_result: CoverageResult, protected readonly _sourceMapCache: V8SourceMapCache) {
    super(_result)
  }

  async init(): Promise<void> {
    const sourceMap = this._sourceMapCache.data
    assert(sourceMap, 'Missing source map data from cache')
    this.#sourceMap = await new SourceMapConsumer(sourceMap)
  }

  async destroy(): Promise<void> {
    this.#sourceMap?.destroy()
  }

  /** Length of each line in the original source file */
  protected get _lineLengths(): readonly number[] {
    return this._sourceMapCache.lineLengths
  }

  coverage(source: string, line: number, column: number): number {
    assert (this.#sourceMap, 'Analyser not initialized')
    const generated = this.#sourceMap.generatedPositionFor({ source, line, column })

    if (! generated) {
      log.debug(`No position generated for ${source}:${line}:${column}`)
      return 0
    }

    if (generated.line == null) {
      log.debug(`No line generated for ${source}:${line}:${column}`)
      return 0
    }

    if (generated.column == null) {
      log.debug(`No column generated for ${source}:${line}:${column}`)
      return 0
    }

    return super.coverage(this._result.url, generated.line, generated.column)
  }
}

/* ========================================================================== */

/** Combine coverage from multiple analysers */
abstract class CoverageCombiner {
  #loggedSources = new Set<string>()

  protected _combineCoverage(
    analysers: CoverageAnalyser[],
    source: string,
    line: number,
    column: number
  ): number {
    /* Log out (once) if we have no coverage analyser for the source */
    if (analysers.length === 0) {
      if (! this.#loggedSources.has(source)) {
        log.debug(`No coverage available for ${source}`)
        this.#loggedSources.add(source)
      }
      return 0
    }

    /* Combine (add) all coverage data from all analysers */
    let coverage = 0

    for (const analyser of analysers) {
      coverage += analyser.coverage(source, line, column)
    }

    return coverage
  }
}

/* ========================================================================== */

/** Associate one or more {@link CoverageAnalyser} with different sources */
export class SourcesCoverageAnalyser extends CoverageCombiner implements CoverageAnalyser {
  #mappings = new Map<string, CoverageAnalyser[]>()

  add(source: string, analyser: CoverageAnalyser) {
    const analysers = this.#mappings.get(source) || []
    analysers.push(analyser)
    this.#mappings.set(source, analysers)
  }

  async init(): Promise<void> {
    for (const analysers of this.#mappings.values()) {
      for (const analyser of analysers) {
        await analyser.init()
      }
    }
  }

  async destroy(): Promise<void> {
    for (const analysers of this.#mappings.values()) {
      for (const analyser of analysers) {
        await analyser.destroy()
      }
    }
  }

  coverage(source: string, line: number, column: number): number {
    const analysers = this.#mappings.get(source) || []
    return this._combineCoverage(analysers, source, line, column)
  }
}

/** Combine multiple {@link CoverageAnalyser} instances together */
export class CombiningCoverageAnalyser extends CoverageCombiner implements CoverageAnalyser {
  #analysers: CoverageAnalyser[] = []

  add(analyser: CoverageAnalyser) {
    this.#analysers.push(analyser)
  }

  async init(): Promise<void> {
    for (const analyser of this.#analysers) {
      await analyser.init()
    }
  }

  async destroy(): Promise<void> {
    for (const analyser of this.#analysers) {
      await analyser.destroy()
    }
  }

  coverage(source: string, line: number, column: number): number {
    return this._combineCoverage(this.#analysers, source, line, column)
  }
}
