import { PistonProvider } from "./piston";
import type { ExecutionProvider } from "./types";
import { WandboxProvider } from "./wandbox";

export { ExecutionRateLimitError } from "./piston";

let provider: ExecutionProvider | null = null;

/**
 * Provider selection (Strategy pattern):
 *  - EXECUTE_API_URL set → self-hosted Piston (full control, e.g. Java 8–25)
 *  - otherwise           → Wandbox (free public: OpenJDK 21/22, CPython 3.7–3.14)
 */
export function getExecutionProvider(): ExecutionProvider {
  provider ??= process.env.EXECUTE_API_URL ? new PistonProvider() : new WandboxProvider();
  return provider;
}
