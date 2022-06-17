import picomatch from 'picomatch'

import { caseSensitivePaths } from './paths'
import { parseOptions, ParseOptions } from './options'

export interface MatchResult {
  /** The glob that matched this `MatchResult` */
  glob: string;
  /** The regular expression that matched this `MatchResult` */
  regex: RegExp;
  /** The input string of this `MatchResult` */
  input: string;
  /** The input string of this `MatchResult` */
  output: string;
  /** The match result of this instance, if any */
  match?: boolean | RegExpExecArray;
  /** Whether the string matched or not */
  isMatch: boolean;
}

export interface MatchOptions {
  /**
   * If set, then patterns without slashes will be matched against the basename
   * of the path if it contains slashes.
   *
   * For example, `a?b` would match the path `/xyz/123/acb`, but not
   * `/xyz/acb/123`.
   *
   * @default false
   */
  basename?: boolean,

  /**
   * Follow bash matching rules more strictly - disallows backslashes as escape
   * characters, and treats single stars as globstars (`**`).
   *
   * @default false
   */
  bash?: boolean,

  /**
   * Return regex matches in `onIgnore(..)`, `onMatch(..)` and `onResult(..)`.
   *
   * @default false
   */
  capture?: boolean,

  /**
   * Allows glob to match any part of the given string(s).
   *
   * @default false
   */
  contains?: boolean,

  /**
   * Debug regular expressions when an error is thrown.
   *
   * @default false
   */
  debug?: boolean,

  /**
   * Enable dotfile matching.
   *
   * By default, dotfiles are ignored unless a `.` is explicitly defined in
   * the pattern, or this option is `true`.
   *
   * @default false
   */
  dot?: boolean,

  /**
   * Custom function for expanding ranges in brace patterns, such as `{a..z}`.
   *
   * The function receives the range values as two arguments, and it must
   * return a string to be used in the generated regex.
   *
   * It's recommended that returned strings be wrapped in parentheses.
   *
   * @default undefined
   */
  expandRange?: (a: string, b: string) => string,

  /**
   * To speed up processing, full parsing is skipped for a handful common glob
   * patterns.
   *
   * Disable this behavior by setting this option to `false`.
   *
   * @default true
   */
  fastpaths?: boolean,

  /**
   * Regex flags to use in the generated regex.
   *
   * If defined, the nocase option will be overridden.
   *
   * @default undefined
   */
  flags?: string,

  /**
   * One or more glob patterns for excluding strings that should not be matched
   * from the result.
   *
   * @default  undefined
   */
  ignore?: string | string[],

  /**
   * Retain quotes in the generated regular expressions, since quotes may also
   * be used as an alternative to backslashes.
   *
   * @default false
   */
  keepQuotes?: boolean,

  /**
   * When `true`, brackets in the glob pattern will be escaped so that only
   * literal brackets will be matched.
   *
   * @default false
   */
  literalBrackets?: boolean,

  /**
   * Disable brace matching, so that `{a,b}` and `{1..3}` would be treated as
   * literal characters.
   *
   * @default false
   */
  nobrace?: boolean,

  /**
   * Disable matching with regex brackets.
   *
   * @default false
   */
  nobracket?: boolean,

  /**
   * Make matching case-insensitive (equivalent to the regex `i` flag).
   *
   * Note that this option is overridden by the flags option.
   *
   * @default false
   */
  nocase?: boolean,

  /**
   * Disable support for matching with extglobs (like `+(a|b)`).
   *
   * @default false
   */
  noextglob?: boolean,

  /**
   * Disable support for matching nested directories with globstars (`**`).
   *
   * @default false
   */
  noglobstar?: boolean,

  /**
   * Disable support for negating with leading `!`.
   *
   * @default false
   */
  nonegate?: boolean,

  /**
   * Disable support for regex quantifiers (like `a{1,2}`) and treat them as
   * brace patterns to be expanded.
   *
   * @default false
   */
  noquantifiers?: boolean,

  /**
   * Function to be called on ignored items.
   *
   * @default undefined
   */
  onIgnore?: (result: MatchResult) => void,

  /**
   * Function to be called on matched items.
   *
   * @default undefined
   */
  onMatch?: (result: MatchResult) => void,

  /**
   * Function to be called on all items, regardless of whether or not they
   * are matched or ignored.
   *
   * @default undefined
   */
  onResult?: (result: MatchResult) => void,

  /**
   * Support POSIX character classes ("posix brackets").
   *
   * @default false
   */
  posix?: boolean,

  /**
   * String to prepend to the generated regex used for matching.
   *
   * @default undefined
   */
  prepend?: string,

  /**
   * Use regular expression rules for `+` (instead of matching literal `+`),
   * and for stars that follow closing parentheses or brackets (as in `)*`
   * and `]*`).
   *
   * @default false
   */
  regex?: boolean,

  /**
   * Throw an error if brackets, braces, or parens are imbalanced.
   *
   * @default false
   */
  strictBrackets?: boolean,

  /**
   * When true, picomatch won't match trailing slashes with single stars.
   *
   * @default false
   */
  strictSlashes?: boolean,

  /**
   * Remove backslashes preceding escaped characters in the glob pattern.
   *
   * By default, backslashes are retained.
   *
   * @default false
   */
  unescape?: boolean,
}

export type Matcher = (string: string) => boolean

export function match(...args: ParseOptions<MatchOptions>): Matcher {
  const { globs, options } = parseOptions(args, __defaults)
  console.log('MATCH', globs, options)
  return picomatch(globs, options)
}

const __defaults = {
  basename: false,
  bash: false,
  capture: false,
  contains: false,
  debug: false,
  dot: false,
  expandRange: undefined,
  fastpaths: true,
  flags: undefined,
  ignore: undefined,
  keepQuotes: false,
  literalBrackets: false,
  nobrace: false,
  nobracket: false,
  nocase: !caseSensitivePaths,
  noextglob: false,
  noglobstar: false,
  nonegate: false,
  noquantifiers: false,
  onIgnore: undefined,
  onMatch: undefined,
  onResult: undefined,
  posix: false,
  prepend: undefined,
  regex: false,
  strictBrackets: false,
  strictSlashes: false,
  unescape: false,
}
