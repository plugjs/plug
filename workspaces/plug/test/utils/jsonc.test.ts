import { JsoncError, parseJsonc } from '../../src/utils/jsonc'

describe('JSONC parser', () => {
  it('should parse a correct JSONC string', () => {
    expect(parseJsonc(`{
      // this is a comment
      "hello": "world",
    }`)).toEqual({ hello: 'world' })
  })

  it('should inform of errors in the correct location', () => {
    expect(() => parseJsonc(`{
      hello: "world",
    }`)).toThrowError(JsoncError, /^Found \d+ error/)

    expect(() => parseJsonc('x')).toThrowError(JsoncError, /^Found \d+ error/)
  })

  it('should return undefined for empty or nullable data', () => {
    expect(parseJsonc(undefined)).toBeUndefined()
    expect(parseJsonc(null)).toBeUndefined()
    expect(parseJsonc('')).toBeUndefined()
  })
})
