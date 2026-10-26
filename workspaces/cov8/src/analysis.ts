import { fileURLToPath, pathToFileURL } from 'node:url'

import { assert } from '@plugjs/plug/asserts'
import { readFile, realpath } from '@plugjs/plug/fs'
import { $gry, $p } from '@plugjs/plug/logging'
import { SourceMapConsumer } from 'source-map'

import type { Logger } from '@plugjs/plug/logging'
import type { AbsolutePath } from '@plugjs/plug/paths'
import type { RawSourceMap } from 'source-map'

/* ========================================================================== *
 * V8 COVERAGE TYPES                                                          *
 * ========================================================================== */

/** Coverage range. */
export interface V8CoveredRange {
  /** The inclusive start offset of the range, in UTF-16 code units. */
  startOffset: number,
  /** The exclusive end offset of the range, in UTF-16 code units. */
  endOffset: number,
  /** The execution count for this range. */
  count: number,
}

/** Per-function coverage reported by V8. */
export interface V8CoveredFunction {
  /** The name of the function being covered. */
  functionName: string,
  /** Whether the ranges include block-level coverage. */
  isBlockCoverage: boolean,
  /**
   * The ranges covered.
   *
   * The first range indicates the whole function.
   */
  ranges: V8CoveredRange[],
}

/** Coverage for a script as recorded by Node.js. */
export interface V8CoverageResult {
  /** The script ID, uniquely identifying the script within the Node process. */
  scriptId: string,
  /** The URL of the script (might not be unique, if the script is loaded multiple times). */
  url: string,
  /** Per-function report of coverage. */
  functions: V8CoveredFunction[]
}

/** Cached source map for a coverage result. */
export interface V8SourceMapCache {
  /** Line lengths in the generated code, as cached by Node.js. */
  lineLengths: number[],
  /** The source map associated with the transpiled code. */
  data: RawSourceMap | null,
  /** The source-map URL, or null for an inline source map. */
  url: string | null,
}

/** Coverage data emitted by Node.js and parsed from JSON. */
export interface V8CoverageData {
  /** Coverage results, with one entry per recorded script. */
  'result': V8CoverageResult[],
  /** Timestamp when coverage was taken. */
  'timestamp'?: number,
  /** Source-map cache entries keyed by script URL. */
  'source-map-cache'?: Record<string, V8SourceMapCache>
}

/* ========================================================================== *
 * COVERAGE ANALYSIS                                                          *
 * ========================================================================== */

/**
 * Bias for mapping original source positions to generated code.
 *
 * The Coverage plug defaults to `least_upper_bound`. Passing `undefined`
 * directly to createAnalyser leaves the source-map library's default in effect.
 * Use `none` to require exact original positions and sum the execution counts
 * of all generated locations mapped to each position.
 */
export type SourceMapBias = 'greatest_lower_bound' | 'least_upper_bound' | 'none' | undefined

/** Interface providing coverage data. */
export interface CoverageAnalyser {
  /** Return the execution count for a source URL, one-based line, and zero-based column. */
  coverage(source: string, line: number, column: number): number
  /**
   * Whether a source URL has an exact mapping at the given one-based line and
   * zero-based column, regardless of execution count. Direct script analysers
   * treat every position in their source as mapped.
   */
  hasMapping(source: string, line: number, column: number): boolean
  /** Release resources held by this analyser. */
  destroy(): void
}

/* ========================================================================== */

/** Base class for coverage analysers with asynchronous initialization. */
abstract class CoverageAnalyserImpl implements CoverageAnalyser {
  constructor(protected readonly _log: Logger) {}

  abstract init(): Promise<this>
  abstract destroy(): void
  abstract coverage(source: string, line: number, column: number): number
  abstract hasMapping(source: string, line: number, column: number): boolean
}


/* ========================================================================== */

/** Return coverage data from a V8 {@link V8CoverageResult} structure. */
class CoverageResultAnalyser extends CoverageAnalyserImpl {
  /** Execution counts indexed by UTF-16 offset in the recorded script. */
  protected readonly _coverage: readonly (number | undefined)[]
  /** Line lengths used to convert line and column positions to script offsets. */
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

  hasMapping(source: string, _line: number, _column: number): boolean {
    return source === this._result.url
  }

  /** Return the execution count for a source URL, one-based line, and zero-based column. */
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

/** Map original source positions to coverage in a generated V8 script. */
class CoverageSitemapAnalyser extends CoverageResultAnalyser {
  private _preciseMappings = new Map<string, { line: number, column: number }[]>()
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

  override async init(): Promise<this> {
    const sourceMap = this._sourceMapCache.data
    assert(sourceMap, 'Missing source map data from cache')
    this._sourceMap = await new SourceMapConsumer(sourceMap)

    this._sourceMap.eachMapping((m) => {
      const location = { line: m.generatedLine, column: m.generatedColumn }
      const key = this._key(m.source, m.originalLine, m.originalColumn)
      const locations = this._preciseMappings.get(key) || []
      locations.push(location)
      this._preciseMappings.set(key, locations)
    })

    return this
  }

  override destroy(): void {
    this._sourceMap?.destroy()
  }

  override hasMapping(source: string, line: number, column: number): boolean {
    return this._preciseMappings.has(this._key(source, line, column))
  }

  override coverage(source: string, line: number, column: number): number {
    assert(this._sourceMap, 'Analyser not initialized')

    if (this._sourceMapBias === 'none') {
      const key = this._key(source, line, column)
      const locations = this._preciseMappings.get(key)
      if (! locations) {
        this._log.debug(`No precise mapping for ${source}:${line}:${column}`)
        return 0
      } else {
        let coverage = 0
        for (const location of locations) {
          coverage += super.coverage(this._result.url, location.line, location.column)
        }
        return coverage
      }
    }

    const bias = mapBias(this._sourceMapBias)

    const generated = this._sourceMap.generatedPositionFor({ source, line, column, bias })

    /* coverage ignore if */
    if (! generated) {
      this._log.debug(`No position generated for ${source}:${line}:${column}`)
      return 0
    }

    /* coverage ignore if */
    if (generated.line == null) {
      this._log.debug(`No line generated for ${source}:${line}:${column}`)
      return 0
    }

    /* coverage ignore if */
    if (generated.column == null) {
      this._log.debug(`No column generated for ${source}:${line}:${column}`)
      return 0
    }

    return super.coverage(this._result.url, generated.line, generated.column)
  }
}

/* ========================================================================== */

function mapBias(bias?: 'greatest_lower_bound' | 'least_upper_bound'): number | undefined {
  if (bias === 'greatest_lower_bound') return SourceMapConsumer.GREATEST_LOWER_BOUND
  if (bias === 'least_upper_bound') return SourceMapConsumer.LEAST_UPPER_BOUND
  /* coverage ignore next */
  return undefined
}

/** Combine (add) all coverage data from all analysers. */
function combineCoverage(
    analysers: Set<CoverageAnalyser>,
    source: string,
    line: number,
    column: number,
): number {
  let coverage = 0

  for (const analyser of analysers) {
    coverage += analyser.coverage(source, line, column)
  }

  return coverage
}

/* ========================================================================== */

/** Associate requested source URLs with analysers and their recorded source URLs. */
export class SourcesCoverageAnalyser extends CoverageAnalyserImpl {
  private readonly _mappings = new Map<string, Map<CoverageAnalyserImpl, string>>()
  private readonly _analysers = new Set<CoverageAnalyserImpl>()

  constructor(log: Logger, private readonly _filename: AbsolutePath) {
    super(log)
  }

  hasMappings(): boolean {
    return this._mappings.size > 0
  }

  add(source: string, analyser: CoverageAnalyserImpl, mappedSource = source): void {
    const analysers = this._mappings.get(source) || new Map()
    analysers.set(analyser, mappedSource)
    this._mappings.set(source, analysers)
    this._analysers.add(analyser)
  }

  async init(): Promise<this> {
    this._log.debug('SourcesCoverageAnalyser', $p(this._filename), $gry(`(${this._mappings.size} mappings)`))
    for (const analyser of this._analysers) await analyser.init()
    return this
  }

  destroy(): void {
    for (const analyser of this._analysers) analyser.destroy()
  }

  coverage(source: string, line: number, column: number): number {
    let coverage = 0
    for (const [ analyser, mappedSource ] of this._mappings.get(source) || []) {
      coverage += analyser.coverage(mappedSource, line, column)
    }
    return coverage
  }

  hasMapping(source: string, line: number, column: number): boolean {
    for (const [ analyser, mappedSource ] of this._mappings.get(source) || []) {
      if (analyser.hasMapping(mappedSource, line, column)) return true
    }
    return false
  }
}

/** Combine multiple {@link CoverageAnalyser} instances together. */
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

  hasMapping(source: string, line: number, column: number): boolean {
    for (const analyser of this._analysers) {
      if (analyser.hasMapping(source, line, column)) return true
    }
    return false
  }
}

/* ========================================================================== */

/** Resolve file aliases without requiring every recorded source to still exist. */
async function canonicalUrl(url: string): Promise<string> {
  if (! url.startsWith('file:')) return url
  try {
    return pathToFileURL(await realpath(fileURLToPath(url))).toString()
  } catch {
    return url
  }
}

/**
 * Create and initialize an analyser for the requested sources using the supplied
 * V8 coverage files. The caller must destroy the analyser when finished.
 */
export async function createAnalyser(
    sourceFiles: AbsolutePath[],
    coverageFiles: AbsolutePath[],
    sourceMapBias: SourceMapBias,
    log: Logger,
): Promise<CoverageAnalyser> {
  /* Internally V8 coverage uses URLs for everything */
  const sources = new Map<string, Set<string>>()
  const canonicalUrls = new Map<string, string>()
  for (const path of sourceFiles) {
    const url = pathToFileURL(path).toString()
    const canonical = await canonicalUrl(url)
    canonicalUrls.set(url, canonical)
    const aliases = sources.get(canonical) || new Set<string>()
    aliases.add(url)
    sources.set(canonical, aliases)
  }

  const matches = async (url: string): Promise<Set<string>> => {
    let canonical = canonicalUrls.get(url)
    if (! canonical) {
      canonical = await canonicalUrl(url)
      canonicalUrls.set(url, canonical)
    }
    return sources.get(canonical) || new Set()
  }

  /* The coverage analyser combining all coverage files in the directory */
  const analyser = new CombiningCoverageAnalyser(log)

  /* Read the coverage files supplied by the caller. */
  for await (const coverageFile of coverageFiles) {
    /* Collect source mappings for this coverage file. */
    const coverageFileAnalyser = new SourcesCoverageAnalyser(log, coverageFile)

    /* Parse our coverage file from JSON */
    log.info('Parsing coverage file', $p(coverageFile))
    const contents = await readFile(coverageFile, 'utf-8')
    const coverage: V8CoverageData = JSON.parse(contents)

    /* Let's look inside of the coverage file... */
    for (const result of coverage.result) {
      if (!result.url.startsWith('node:')) {
        log.debug('Found coverage data for', result.url)
      }

      /*
       * A script may have a source map, including one that maps its URL back
       * to itself after a loader has transformed the code.
       */
      const mapping = coverage['source-map-cache']?.[result.url]
      if (mapping?.data) {
        log.debug('Found source mapping for', result.url, mapping.data)

        /* Match source-map entries to requested sources, resolving aliases. */
        let sourceAnalyser: CoverageSitemapAnalyser | undefined
        for (const source of mapping.data.sources) {
          for (const match of await matches(source)) {
            sourceAnalyser ||= new CoverageSitemapAnalyser(log, result, mapping, sourceMapBias)
            coverageFileAnalyser.add(match, sourceAnalyser, source)
          }
        }

      /* Without usable source-map data, match the recorded script directly. */
      } else {
        const aliases = await matches(result.url)
        if (aliases.size) {
          const sourceAnalyser = new CoverageResultAnalyser(log, result)
          for (const alias of aliases) coverageFileAnalyser.add(alias, sourceAnalyser, result.url)
        }
      }
    }

    /* Add the analyser if it has some mappings */
    if (coverageFileAnalyser.hasMappings()) analyser.add(coverageFileAnalyser)
  }

  return await analyser.init()
}
