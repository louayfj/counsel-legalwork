import { describe, expect, test } from "bun:test";

import { resolveAppAssetSrc } from "../src/react-app/design-system/extension-icon-src";

describe("app asset URLs", () => {
  test("resolves root assets against the web development base", () => {
    expect(resolveAppAssetSrc("/brand/logo/counsel-by-axleo-black.svg", "/"))
      .toBe("/brand/logo/counsel-by-axleo-black.svg");
  });

  test("resolves root assets relative to a packaged Electron index", () => {
    expect(resolveAppAssetSrc("/brand/logo/counsel-by-axleo-black.svg", "./"))
      .toBe("./brand/logo/counsel-by-axleo-black.svg");
  });

  test("leaves data and remote asset URLs unchanged", () => {
    expect(resolveAppAssetSrc("data:image/png;base64,logo", "./"))
      .toBe("data:image/png;base64,logo");
    expect(resolveAppAssetSrc("https://example.com/logo.svg", "./"))
      .toBe("https://example.com/logo.svg");
  });
});
