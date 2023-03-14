import * as assert from 'node:assert'

import { expect as chaiExpect } from 'chai'

describe('Expectations tests', () => {
  describe('Jasmine expectations', () => {
    it('should produce some nice differences for objects', () => {
      expect({ foo: 'bar', hello: 'world', zap: true })
          .toEqual({ foo: 'baz', hello: 'world', zap: false })
    })

    it('should produce some nice differences for arrays', () => {
      expect([ 'foo', 'bar', 'baz' ]).toEqual([ 'baz', 'bar', 'foo' ])
    })

    it('should produce some nice differences for strings', () => {
      expect('The brown fox jumped over the lazy dog')
          .toEqual('The quick fox jumped over the sleeping dog')
    })

    it('should highligt the different types when they differ', () => {
      expect({ foo: 'bar', hello: 'world' } as any)
          .toEqual([ 'foo bar', 'hello world' ] as any)
    })
  })

  xdescribe('Jasmine expectations with contexts', () => {
    it('should produce some nice differences for objects', () => {
      expect({ foo: 'bar', hello: 'world', zap: true })
          .withContext('A simple context')
          .toEqual({ foo: 'baz', hello: 'world', zap: false })
    })

    it('should produce some nice differences for arrays', () => {
      expect([ 'foo', 'bar', 'baz' ])
          .withContext('A simple context')
          .toEqual([ 'baz', 'bar', 'foo' ])
    })

    it('should produce some nice differences for strings', () => {
      expect('The brown fox jumped over the lazy dog')
          .withContext('A simple context')
          .toEqual('The quick fox jumped over the sleeping dog')
    })

    it('should highligt the different types when they differ', () => {
      expect({ foo: 'bar', hello: 'world' } as any)
          .withContext('A simple context')
          .toEqual([ 'foo bar', 'hello world' ] as any)
    })
  })

  /* ======================================================================== */

  describe('Chai expectations', () => {
    it('should produce some nice differences for objects with chai', () => {
      chaiExpect({ foo: 'bar', hello: 'world', zap: true })
          .to.eql({ foo: 'baz', hello: 'world', zap: false })
    })

    it('should produce some nice differences for arrays with chai', () => {
      chaiExpect([ 'foo', 'bar', 'baz' ])
          .to.eql([ 'baz', 'bar', 'foo' ])
    })

    it('should produce some nice differences for strings with chai', () => {
      chaiExpect('The brown fox jumped over the lazy dog')
          .to.eql('The quick fox jumped over the sleeping dog')
    })

    it('should highligt the different types when they differ with chai', () => {
      chaiExpect({ foo: 'bar', hello: 'world' })
          .to.eql([ 'foo bar', 'hello world' ])
    })
  })

  describe('Chai expectations with messages', () => {
    it('should produce some nice differences for objects with chai', () => {
      chaiExpect({ foo: 'bar', hello: 'world', zap: true }, 'A simple message')
          .to.eql({ foo: 'baz', hello: 'world', zap: false })
    })

    it('should produce some nice differences for arrays with chai', () => {
      chaiExpect([ 'foo', 'bar', 'baz' ], 'A simple message')
          .to.eql([ 'baz', 'bar', 'foo' ])
    })

    it('should produce some nice differences for strings with chai', () => {
      chaiExpect('The brown fox jumped over the lazy dog', 'A simple message')
          .to.eql('The quick fox jumped over the sleeping dog')
    })

    it('should highligt the different types when they differ with chai', () => {
      chaiExpect({ foo: 'bar', hello: 'world' }, 'A simple message')
          .to.eql([ 'foo bar', 'hello world' ])
    })
  })

  /* ======================================================================== */

  describe('Assertion errors', () => {
    it('should produce some nice differences for objects with assert', () => {
      assert.deepEqual(
          { foo: 'bar', hello: 'world', zap: true },
          { foo: 'baz', hello: 'world', zap: false },
      )
    })

    it('should produce some nice differences for arrays with assert', () => {
      assert.deepEqual(
          [ 'foo', 'bar', 'baz' ],
          [ 'baz', 'bar', 'foo' ],
      )
    })

    it('should produce some nice differences for strings with assert', () => {
      assert.equal(
          'The brown fox jumped over the lazy dog',
          'The quick fox jumped over the sleeping dog',
      )
    })

    it('should highligt the different types when they differ with assert', () => {
      assert.deepEqual(
          { foo: 'bar', hello: 'world' },
          [ 'foo bar', 'hello world' ],
      )
    })
  })

  describe('Assertion errors with messages', () => {
    it('should produce some nice differences for objects with assert', () => {
      assert.deepEqual(
          { foo: 'bar', hello: 'world', zap: true },
          { foo: 'baz', hello: 'world', zap: false },
          'A simple message',
      )
    })

    it('should produce some nice differences for arrays with assert', () => {
      assert.deepEqual(
          [ 'foo', 'bar', 'baz' ],
          [ 'baz', 'bar', 'foo' ],
          'A simple message',
      )
    })

    it('should produce some nice differences for strings with assert', () => {
      assert.equal(
          'The brown fox jumped over the lazy dog',
          'The quick fox jumped over the sleeping dog',
          'A simple message',
      )
    })

    it('should highligt the different types when they differ with assert', () => {
      assert.deepEqual(
          { foo: 'bar', hello: 'world' },
          [ 'foo bar', 'hello world' ],
          'A simple message',
      )
    })
  })
})
