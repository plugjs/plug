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
export {
  f,
  n,
  p1,
  p2
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsic291cmNlbWFwLnRzIl0sCiAgIm1hcHBpbmdzIjogIkFBR0EsTUFBTSxJQUFJO0FBQUEsRUFFUixZQUFtQixNQUFjO0FBQWQ7QUFBQSxFQUFlO0FBQ3BDO0FBT08sTUFBTSxLQUFLLFFBQVEsSUFBSSxPQUFPO0FBQUE7QUFBQSxFQUFrQztBQUFBO0FBQ2hFLE1BQU0sS0FBSyxRQUFRLElBQUksT0FBTyxPQUFPO0FBRXJDLE1BQU0sSUFBSSxTQUFTLEtBQUs7QUFHeEIsU0FBUyxJQUFrQjtBQUNoQyxTQUFPLFFBQVEsUUFBUSxJQUFJLElBQUksS0FBSyxDQUFDO0FBQ3ZDO0FBT0EsRUFBRSxFQUFFLEtBQUssTUFBTTtBQUFDLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
