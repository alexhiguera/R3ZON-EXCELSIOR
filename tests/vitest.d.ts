import "vitest";

// `jest-axe` publica sus tipos para Jest. El matcher se registra en
// `tests/setup.ts`; esto solo se lo cuenta a TypeScript.
declare module "vitest" {
  interface Matchers<T = unknown> {
    toHaveNoViolations(): T;
  }
}
