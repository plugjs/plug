import type { AbsolutePath } from '../paths'
import type { Run } from '../run'

import { readFile } from '../utils/asyncfs'
import { $blu, $cyn, $gry, $red, $und, $wht, $ylw } from './colors'
import { buildFailed } from './constants'
import { emit } from './emit'
import { LogLevel, logLevels } from './options'

/* ========================================================================== */

/** Levels used in a {@link Report}  */
export type ReportLevel = Extract<LogLevel, 'NOTICE' | 'WARN' | 'ERROR'>

/** A record for a {@link Report} */
export interface ReportRecord {
  /** The _level_ (or _severity_) of this {@link ReportRecord}. */
  level: ReportLevel,
  /** A detail message to associate with this {@link ReportRecord}. */
  message: string | string[]

  /**
   * Tags to associate with this{@link ReportRecord}.
   *
   * Those are error categories, or error codes and are directly related with
   * whatever produced the {@link Report}.
   */
  tags?: string [] | string | null | undefined

  /** Line number in the source code (starting at `1`) */
  line?: number | null | undefined
  /** Column number in the source code (starting at `1`) */
  column?: number | null | undefined
  /** Number of characters involved (`-1` means until the end of the line ) */
  length?: number | null | undefined

  /** The {@link AbsolutePath} of the file associated with this. */
  file?: AbsolutePath | null | undefined,
  /** The _real source code_ associated with this (for error higlighting). */
  source?: string | null | undefined
}

/** A {@link Report} that will standardise the way we output information. */
export interface Report {
  /** The number of `notice` records _and_ annotations in this {@link Report}. */
  readonly notices: number
  /** The number of `warning` records _and_ annotations in this {@link Report}. */
  readonly warnings: number
  /** The number of `error` records _and_ annotations in this {@link Report}. */
  readonly errors: number

  /** The number of `notice` records in this {@link Report}. */
  readonly noticeRecords: number
  /** The number of `warning` records in this {@link Report}. */
  readonly warningRecords: number
  /** The number of `error` records in this {@link Report}. */
  readonly errorRecords: number

  /** The number of `notice` annotations in this {@link Report}. */
  readonly noticeAnnotations: number
  /** The number of `warning` annotations in this {@link Report}. */
  readonly warningAnnotations: number
  /** The number of `error` annotations in this {@link Report}. */
  readonly errorAnnotations: number

  /** The number of _all_ records in this {@link Report} */
  readonly records: number
  /** The number of _all_ annotations in this {@link Report} */
  readonly annotations: number

  /** Checks whether this {@link Report} contains records or annotations */
  readonly empty: boolean

  /** Add a new {@link ReportRecord | record} to this {@link Report}. */
  add(...records: ReportRecord[]): this

  /** Add an annotation (small note) for a file in this report */
  annotate(level: ReportLevel, file: AbsolutePath, note: string): this

  /** Attempt to load any source file missing from the reports */
  loadSources(): Promise<void>

  /** Emit this {@link Report}. */
  emit(showSources?: boolean | undefined): this

  /**
   * Fail the build.
   *
   * Useful in chained constructs like:
   *
   * ```
   * if (report.errors) report.emit().fail()
   * ```
   */
  fail(...args: any[]): never
}

/** Create a new {@link Report} with the given title */
export function createReport(title: string, run: Run): Report {
  return new ReportImpl(run.taskName || '', title)
}

/* ========================================================================== *
 * REPORT IMPLEMENTATION                                                      *
 * ========================================================================== */

interface ReportInternalRecord {
  readonly level: typeof logLevels[ReportLevel]
  readonly messages: readonly string[]
  readonly tags: readonly string[]
  readonly line: number
  readonly column: number
  readonly length: number
}

interface ReportInternalAnnotation {
  readonly level: typeof logLevels[ReportLevel]
  readonly note: string
}

class ReportImpl implements Report {
  private readonly _sources = new Map<AbsolutePath, string[]>()
  private readonly _annotations = new Map<AbsolutePath, ReportInternalAnnotation>()
  private readonly _records = new Map<AbsolutePath | null, Set<ReportInternalRecord>>()
  private _noticeRecords = 0
  private _warningRecords = 0
  private _errorRecords = 0
  private _noticeAnnotations = 0
  private _warningAnnotations = 0
  private _errorAnnotations = 0

  constructor(
      private readonly _task: string,
      private readonly _title: string,
  ) {}

  get notices(): number {
    return this._noticeRecords + this._noticeAnnotations
  }

  get warnings(): number {
    return this._warningRecords + this._warningAnnotations
  }

  get errors(): number {
    return this._errorRecords + this._errorAnnotations
  }

  get noticeRecords(): number {
    return this._noticeRecords
  }

  get warningRecords(): number {
    return this._warningRecords
  }

  get errorRecords(): number {
    return this._errorRecords
  }

  get noticeAnnotations(): number {
    return this._noticeAnnotations
  }

  get warningAnnotations(): number {
    return this._warningAnnotations
  }

  get errorAnnotations(): number {
    return this._errorAnnotations
  }

  get records(): number {
    return this._noticeRecords + this._warningRecords + this._errorRecords
  }

  get annotations(): number {
    return this._noticeAnnotations + this._warningAnnotations + this._errorAnnotations
  }


  get empty(): boolean {
    return ! (this.records + this.annotations)
  }

  private _level(level: ReportLevel): typeof logLevels[ReportLevel] {
    const _level =
        level === 'NOTICE' ? logLevels.NOTICE :
        level === 'WARN' ? logLevels.WARN :
        level === 'ERROR' ? logLevels.ERROR :
        this.fail(`Wrong record level "${level}"`)
    return _level
  }

  annotate(annotationLevel: ReportLevel, file: AbsolutePath, note: string): this {
    if (note) {
      const level = this._level(annotationLevel)
      this._annotations.set(file, { level, note })
      switch (level) {
        case logLevels.NOTICE: this._noticeRecords ++; break
        case logLevels.WARN: this._warningRecords ++; break
        case logLevels.ERROR: this._errorRecords ++; break
      }
    }
    return this
  }

  add(...records: ReportRecord[]): this {
    for (const record of records) {
      /* Normalize the basic entries in this message */
      let messages =
        Array.isArray(record.message) ?
            [ ...record.message ] :
            record.message.split('\n')
      messages = messages.filter((message) => !! message)
      if (! messages.length) this.fail('No message for report record')

      const file = record.file || null // use "null" as "undefined" doesn't get sorted!
      const source = record.source || undefined
      const tags = record.tags ?
        Array.isArray(record.tags) ?
            [ ...record.tags ] :
            [ record.tags ] :
            []

      const level = this._level(record.level)

      switch (level) {
        case logLevels.NOTICE: this._noticeRecords ++; break
        case logLevels.WARN: this._warningRecords ++; break
        case logLevels.ERROR: this._errorRecords ++; break
      }

      /* Line, column and characters are a bit more complicated */
      let line: number = 0
      let column: number = 0
      let length: number = 1

      if (file && record.line) {
        line = record.line
        if (record.column) {
          column = record.column
          if (record.length) {
            length = record.length
            if (length < 0) {
              length = Number.MAX_SAFE_INTEGER
            }
          }
        }
      }

      /* Remember our source code, line by line */
      if ((file && source) && (! this._sources.has(file))) {
        this._sources.set(file, source.split('\n'))
      }

      /* Remember this normalized report */
      let reports = this._records.get(file)
      if (! reports) this._records.set(file, reports = new Set())
      reports.add({ level, messages, tags, line, column, length: length })
    }

    /* All done */
    return this
  }

  async loadSources(): Promise<void> {
    // Read files in parallel
    const promises: Promise<any>[] = []

    // Iterate through all the files having records
    for (const file of this._records.keys()) {
      if (! file) continue // no "null" file
      if (this._sources.has(file)) continue
      promises.push(readFile(file, 'utf-8')
          .then((source) => source.split('\n'))
          .then((lines) => this._sources.set(file, lines)))
    }

    // Await _all_ promise, ignore errors
    await Promise.allSettled(promises)
  }

  emit(showSources = false): this {
    /* Counters for all we need to print nicely */
    let fPad = 0
    let aPad = 0
    let mPad = 0
    let lPad = 0
    let cPad = 0

    /* This is GIANT: sort and convert our data for easy reporting */
    const entries = [ ...this._annotations.keys(), ...this._records.keys() ]
        // dedupe
        .filter((file, i, a) => a.indexOf(file) === i) // dedupe

        // sort ("null" files first - remember, "undefined" never gets sorted)
        .sort((a, b) => {
          return ((a || '') < (b || '')) ? -1 : ((a || '') > (b || '')) ? 1 : 0
        })

        // map to a [ file, record[], annotation? ]
        .map((file) => {
          // Get our annotation for the file
          const ann = file && this._annotations.get(file)

          // Get the records (or an empty record array)
          const records = [ ...(this._records.get(file) || []) ]
              // Sort records by line / column
              .sort(({ line: al, column: ac }, { line: bl, column: bc }) =>
                ((al || Number.MAX_SAFE_INTEGER) - (bl || Number.MAX_SAFE_INTEGER)) ||
                ((ac || Number.MAX_SAFE_INTEGER) - (bc || Number.MAX_SAFE_INTEGER)) )

              // Update our record padding length
              .map((record) => {
                if (record.line && (record.line > lPad)) lPad = record.line
                if (record.column && (record.column > cPad)) cPad = record.column
                for (const message of record.messages) {
                  if (message.length > mPad) mPad = message.length
                }
                return record
              })

          // Update our file and annotation padding lengths
          if (file && (file.length > fPad)) fPad = file.length
          if (ann && (ann.note.length > aPad)) aPad = ann.note.length

          // Return our entry
          return { file, records, annotation: ann }
        })

    /* Adjust paddings... */
    mPad = mPad <= 100 ? mPad : 0 // limit length of padding for breakaway lines
    lPad = lPad.toString().length
    cPad = cPad.toString().length

    emit(this._task, logLevels.INFO, '')
    emit(this._task, logLevels.INFO, $und($wht(this._title)))


    /* Iterate through all our [file,reports] tuple */
    for (let f = 0; f < entries.length; f ++) {
      const { file, records, annotation } = entries[f]
      const source = file && this._sources.get(file)

      if ((f === 0) || entries[f - 1]?.records.length) emit(this._task, logLevels.INFO, '')
      if (file && annotation) {
        const { level, note } = annotation
        const $col = level === logLevels.NOTICE ? $blu : level === logLevels.WARN ? $ylw : $red
        const ann = `${$gry('[')}${$col(note.padStart(aPad))}${$gry(']')}`
        const pad = ''.padStart(fPad - file.length) // file is underlined

        emit(this._task, level, $wht($und(file)), pad, ann)
      } else if (file) {
        emit(this._task, logLevels.INFO, $wht($und(file)))
      }

      /* Now get each message and do our magic */
      for (let r = 0; r < records.length; r ++) {
        const { level, messages, tags, line, column, length = 1 } = records[r]

        /* Prefix includes line and column */
        let pfx: string
        if (file && line) {
          if (column) {
            pfx = `  ${line.toString().padStart(lPad)}:${column.toString().padEnd(cPad)} `
          } else {
            pfx = `  ${line.toString().padStart(lPad)}:${'-'.padEnd(cPad)} `
          }
        } else {
          pfx = `  ${'-'.padStart(lPad)}:${'-'.padEnd(cPad)} `
        }
        const pfx2 = ''.padStart(pfx.length)

        /* Nice tags */
        const tag = tags.length == 0 ? '' :
          `${$gry('[')}${tags.map((tag) => $cyn(tag)).join($gry('|'))}${$gry(']')}`

        /* Print out our messages, one by one */
        if (messages.length === 1) {
          emit(this._task, level, $gry(pfx), messages[0].padEnd(mPad), tag)
        } else {
          for (let m = 0; m < messages.length; m ++) {
            if (! m) { // first line
              emit(this._task, level, $gry(pfx), messages[m])
            } else if (m === messages.length - 1) { // last line
              emit(this._task, level, $gry(pfx2), messages[m].padEnd(mPad), tag)
            } else { // in between lines
              emit(this._task, level, $gry(pfx2), messages[m])
            }
          }
        }

        /* See if we have to / can print out the source */
        if (showSources && source && source[line - 1]) {
          if (column) {
            const $col = level === logLevels.NOTICE ? $blu : level === logLevels.WARN ? $ylw : $red
            const offset = column - 1
            const head = $gry(source[line - 1].substring(0, offset))
            const body = $und($col(source[line - 1].substring(offset, offset + length)))
            const tail = $gry(source[line - 1].substring(offset + length))

            emit(this._task, level, pfx2, $gry(`| ${head}${body}${tail}`))
          } else {
            emit(this._task, level, pfx2, $gry(`| ${source[line - 1]}`))
          }
        }
      }
    }

    /* Our totals */
    const eLabel = this.errors === 1 ? 'error' : 'errors'
    const wLabel = this.warnings === 1 ? 'warning' : 'warnings'
    const eNumber = this.errors ? $red(this.errors) : 'no'
    const wNumber = this.warnings ? $ylw(this.warnings) : 'no'

    emit(this._task, logLevels.INFO, '')
    emit(this._task, logLevels.INFO, 'Found', eNumber, eLabel, 'and', wNumber, wLabel)
    emit(this._task, logLevels.INFO, '')

    return this
  }

  fail(...args: any[]): never {
    emit(this._task, logLevels.ERROR, ...args)
    throw buildFailed
  }
}
