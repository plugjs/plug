/** A {@link RegExp} matching ANSI escapes */
export const ansiRegExp = new RegExp([
  '[\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]+)*|[a-zA-Z\\d]+(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)',
  '(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-nq-uy=><~]))',
].join('|'), 'g')

/** Strip ANSI characters (colors) from a string */
export function stripAnsi(string: string): string {
  return string && string.replace(ansiRegExp, '')
}
