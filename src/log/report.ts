import { BuildFailure } from '../failure'
import { AbsolutePath } from '../paths'
import { readFile } from '../utils/asyncfs'
import { $blu, $cyn, $gry, $red, $und, $wht, $ylw } from './colors'
import { LogEmitter } from './emit'
import { ERROR, LogLevels, NOTICE, WARN } from './levels'
import { logOptions } from './options'

/* ========================================================================== */

/** Levels used in a {@link Report}  */
export type ReportLevel = LogLevels['NOTICE' | 'WARN' | 'ERROR']

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

  /** Emit this {@link Report} and throw a build failure on error. */
  done(showSources?: boolean | undefined): void
}

/* ========================================================================== *
 * REPORT IMPLEMENTATION                                                      *
 * ========================================================================== */

const nul = '\u2400' // null, yep, as a character, always gets sorted last
type Null = typeof nul

interface ReportInternalRecord {
  readonly level: ReportLevel
  readonly messages: readonly string[]
  readonly tags: readonly string[]
  readonly line: number
  readonly column: number
  readonly length: number
}

interface ReportInternalAnnotation {
  readonly level: ReportLevel
  readonly note: string
}

export class ReportImpl implements Report {
  private readonly _sources = new Map<AbsolutePath, string[]>()
  private readonly _annotations = new Map<AbsolutePath, ReportInternalAnnotation>()
  private readonly _records = new Map<AbsolutePath | Null, Set<ReportInternalRecord>>()
  private _noticeRecords = 0
  private _warningRecords = 0
  private _errorRecords = 0
  private _noticeAnnotations = 0
  private _warningAnnotations = 0
  private _errorAnnotations = 0

  constructor(
      private readonly _title: string,
      private readonly _task: string,
      private readonly _emitter: LogEmitter,
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

  annotate(annotationLevel: ReportLevel, file: AbsolutePath, note: string): this {
    if (note) {
      const level = annotationLevel
      this._annotations.set(file, { level, note })
      switch (level) {
        case NOTICE: this._noticeRecords ++; break
        case WARN: this._warningRecords ++; break
        case ERROR: this._errorRecords ++; break
      }
    }
    return this
  }

  add(...records: ReportRecord[]): this {
    for (const record of records) {
      /* Normalize the basic entries in this message */
      let messages =
        Array.isArray(record.message) ?
            [ ...record.message.map((msg) => msg.split('\n')).flat(1) ] :
            record.message.split('\n')
      messages = messages.filter((message) => !! message)
      if (! messages.length) {
        const options = { taskName: this._task, level: ERROR }
        this._emitter(options, [ 'No message for report record' ])
        throw BuildFailure.fail()
      }

      const level = record.level
      const file = record.file
      const source = record.source || undefined
      const tags = record.tags ?
        Array.isArray(record.tags) ?
            [ ...record.tags ] :
            [ record.tags ] :
            []

      switch (level) {
        case NOTICE: this._noticeRecords ++; break
        case WARN: this._warningRecords ++; break
        case ERROR: this._errorRecords ++; break
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
      let reports = this._records.get(file || nul)
      if (! reports) this._records.set(file || nul, reports = new Set())
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
      if (! file) continue
      if (file === nul) continue
      if (this._sources.has(file)) continue
      promises.push(readFile(file, 'utf-8')
          .then((source) => source.split('\n'))
          .then((lines) => this._sources.set(file, lines)))
    }

    // Await _all_ promise, ignore errors
    await Promise.allSettled(promises)
  }


  done(showSources?: boolean | undefined): void {
    if (showSources == null) showSources = logOptions.showSources
    if (! this.empty) this._emit(showSources)
    if (this.errors) throw BuildFailure.fail()
  }

  private _emit(showSources: boolean): this {
    /* Counters for all we need to print nicely */
    let fPad = 0
    let aPad = 0
    let mPad = 0
    let lPad = 0
    let cPad = 0

    /* Skip report all together if empty! */
    if ((this._annotations.size === 0) && (this._records.size === 0)) return this

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
          const ann = file && file !== nul && this._annotations.get(file)

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

    /* Basic emit options */
    const options = { taskName: this._task, level: NOTICE }

    this._emitter(options, [ '' ])
    this._emitter(options, [ $und($wht(this._title)) ])

    /* Iterate through all our [file,reports] tuple */
    for (let f = 0; f < entries.length; f ++) {
      const { file, records, annotation } = entries[f]
      const source = file && file != nul && this._sources.get(file)

      if ((f === 0) || entries[f - 1]?.records.length) {
        this._emitter(options, [ '' ])
      }

      if (file && file !== nul && annotation) {
        const { level, note } = annotation
        const $col = level === NOTICE ? $blu : level === WARN ? $ylw : $red
        const ann = `${$gry('[')}${$col(note)}${$gry(']')}`
        const pad = ''.padStart((fPad + aPad) - (file.length + note.length))

        this._emitter({ ...options, level }, [ $wht($und(file)), pad, ann ])
      } else if (file !== nul ) {
        this._emitter(options, [ $wht($und(file)) ])
      } else if (f > 0) {
        this._emitter(options, [ '' ]) // white line for the last
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
        } else if (file != nul) {
          pfx = `  ${'-'.padStart(lPad)}:${'-'.padEnd(cPad)} `
        } else {
          pfx = '  ~ '
        }

        const prefix = ''.padStart(pfx.length + 1)

        /* Nice tags */
        const tag = tags.length == 0 ? '' :
          `${$gry('[')}${tags.map((tag) => $cyn(tag)).join($gry('|'))}${$gry(']')}`

        /* Print out our messages, one by one */
        if (messages.length === 1) {
          this._emitter({ ...options, level }, [ $gry(pfx), messages[0].padEnd(mPad), tag ])
        } else {
          for (let m = 0; m < messages.length; m ++) {
            if (! m) { // first line
              this._emitter({ ...options, level }, [ $gry(pfx), messages[m] ])
            } else if (m === messages.length - 1) { // last line
              this._emitter({ ...options, level, prefix }, [ messages[m].padEnd(mPad), tag ])
            } else { // in between lines
              this._emitter({ ...options, level, prefix }, [ messages[m] ])
            }
          }
        }

        /* See if we have to / can print out the source */
        if (showSources && source && source[line - 1]) {
          if (column) {
            const $col = level === NOTICE ? $blu : level === WARN ? $ylw : $red
            const offset = column - 1
            const head = $gry(source[line - 1].substring(0, offset))
            const body = $und($col(source[line - 1].substring(offset, offset + length)))
            const tail = $gry(source[line - 1].substring(offset + length))

            this._emitter({ ...options, level, prefix }, [ $gry(`| ${head}${body}${tail}`) ])
          } else {
            this._emitter({ ...options, level, prefix }, [ $gry(`| ${source[line - 1]}`) ])
          }
        }
      }
    }

    /* Our totals (if any) */
    this._emitter(options, [ '' ])

    const status: any[] = [ 'Found' ]
    if (this.errors) {
      status.push($red(this.errors), this.errors === 1 ? 'error' : 'errors' )
    }

    if (this.warnings) {
      if (this.errors) status.push('and')
      status.push($ylw(this.warnings), this.warnings === 1 ? 'warning' : 'warnings' )
    }

    if (this.errors || this.warnings) {
      this._emitter(options, status)
      this._emitter(options, [ '' ])
    }

    /* Done! */
    return this
  }
}
