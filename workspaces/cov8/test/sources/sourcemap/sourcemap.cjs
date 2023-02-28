"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var sourcemap_exports = {};
__export(sourcemap_exports, {
  f: () => f,
  n: () => n,
  p1: () => p1,
  p2: () => p2
});
module.exports = __toCommonJS(sourcemap_exports);
class Foo {
  constructor(_foo) {
    this._foo = _foo;
  }
}
const p1 = process.env.PATH ? true : (
  /* coverage ignore next */
  false
);
const p2 = process.env.PATH ? true : false;
const n = parseInt("100");
function f() {
  return Promise.resolve(new Foo("bar"));
}
f().then(() => {
});
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  f,
  n,
  p1,
  p2
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic291cmNlbWFwLnRzIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUdBLE1BQU0sSUFBSTtBQUFBLEVBRVIsWUFBbUIsTUFBYztBQUFkO0FBQUEsRUFBZTtBQUNwQztBQU9PLE1BQU0sS0FBSyxRQUFRLElBQUksT0FBTztBQUFBO0FBQUEsRUFBa0M7QUFBQTtBQUNoRSxNQUFNLEtBQUssUUFBUSxJQUFJLE9BQU8sT0FBTztBQUVyQyxNQUFNLElBQUksU0FBUyxLQUFLO0FBR3hCLFNBQVMsSUFBa0I7QUFDaEMsU0FBTyxRQUFRLFFBQVEsSUFBSSxJQUFJLEtBQUssQ0FBQztBQUN2QztBQU9BLEVBQUUsRUFBRSxLQUFLLE1BQU07QUFBQyxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
