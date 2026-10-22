import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { toHaveNoViolations } from "jest-axe";
import { afterEach, expect } from "vitest";

expect.extend(toHaveNoViolations);

// Testing Library solo desmonta sola con `globals: true`; aquí se hace explícito.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
