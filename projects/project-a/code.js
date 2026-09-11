function myFunction() {
  console.log("project-a");
}

/**
 * サンプル: テスト対象になりうる純粋関数の例。
 * SpreadsheetApp 等の GAS 依存を持たない処理はこのように切り出すと
 * code.test.js から node:vm 経由でテストできる。
 */
function formatGreeting_(name) {
  return `Hello, ${name}!`;
}
