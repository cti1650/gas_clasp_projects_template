const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { createContext, runInContext } = require("node:vm");
const { join } = require("node:path");

const GAS_PATH = join(__dirname, "code.js");

/**
 * code.js を vm コンテキストで読み込み、トップレベル関数を取り出す。
 * SpreadsheetApp 等の GAS グローバルに依存する関数をテストする場合は
 * ここに必要なモックを追加する（例: PropertiesService, UrlFetchApp）。
 */
function loadGas() {
  const context = createContext({ console });
  runInContext(readFileSync(GAS_PATH, "utf8"), context);
  return context;
}

describe("formatGreeting_", () => {
  it("returns a greeting for the given name", () => {
    const gas = loadGas();
    assert.equal(gas.formatGreeting_("World"), "Hello, World!");
  });
});
