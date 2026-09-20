import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // graphql-js ships both CJS and ESM builds; without forcing a single
    // resolved instance, @graphql-tools/load (loaded via CJS require) and
    // our own ESM imports end up with two separate module realms, which
    // breaks `instanceof`-based type guards like isObjectType().
    dedupe: ["graphql"],
  },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    server: {
      // Without this, graphql-tools (CJS, required by Node directly) and
      // our own ESM source resolve to two separate "graphql" module
      // instances even with `dedupe`. Inlining forces both through Vite's
      // resolver so `dedupe` actually applies.
      deps: {
        inline: [/@graphql-tools\//, "graphql"],
      },
    },
  },
});
