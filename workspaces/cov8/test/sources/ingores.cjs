'use strict'

/* coverage ignore try */
/* coverage ignore catch */
/* coverage ignore finally */
try {
  throw new Error('Foo')
} catch (error) {
  void error
} finally {
  parseInt('123')
}

/* coverage ignore next */
try {
  throw new Error('Foo')
} catch (error) {
  void error
} finally {
  parseInt('123')
}

try {
  throw new Error('Foo')
} catch (error) {
  void error
} finally {
  parseInt('123')
}
/* coverage ignore prev */

/* this is covered */
try {
  throw new Error('Foo')
} catch (error) {
  void error
} finally {
  parseInt('123')
}

/* coverage ignore test */
if (parseInt('123') === 123) {
  parseInt('123')
}

/* coverage ignore if */
if (parseInt('123') !== 123) {
  parseInt('123')
} else {
  parseInt('123')
}

/* coverage ignore else */
if (parseInt('123') === 123) {
  parseInt('123')
} else {
  parseInt('123')
}
