// class SimpleExpectation<M extends ExpectationMatcher> implements Expectation<M> {
//   constructor(private _matcher: M) {}

//   expect(what: unknown): M {
//     void what
//     return this._matcher
//   }
// }

// type ConstructorExpectations = [ Constructor, ExpectationMatcher ]
// type ConstructorExpectationsMatchers<T extends ConstructorExpectations[]> =
//   T[number][1]


// class ConstructorExpectation<T extends ConstructorExpectations[]>
// implements Expectation<ConstructorExpectationsMatchers<T>> {
//   constructor(private matchers: T) {
//     void this.matchers
//   }

//   expect(what: unknown): ConstructorExpectationsMatchers<T> {
//     void what
//     return <any> null
//   }
// }

// class ToIncludeArray implements ExpectationMatcher {
//   match(what: unknown, match: readonly any []): void {
//     void what, match
//   }
// }

// class ToIncludeRecord implements ExpectationMatcher {
//   match(what: unknown, match: NonArrayObject): void {
//     void what, match
//   }
// }

// class ToIncludeString implements ExpectationMatcher {
//   match(what: unknown, match: string): void {
//     void what, match
//   }
// }

// const ce = new ConstructorExpectation([
//   [ Array, new ToIncludeArray() ],
//   [ Object, new ToIncludeRecord() ],
//   [ String, new ToIncludeString() ],
// ])
