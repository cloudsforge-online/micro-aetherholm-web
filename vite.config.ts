import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

/**
 * There is deliberately no `define`, no `envPrefix` and no `.env` file in this repository.
 *
 * A build-time constant is an environment baked into an image, and an image with an environment
 * baked into it has to be rebuilt to be promoted — which means the artefact that reaches
 * production is not the artefact that passed CI. Every host this app talks to is resolved at
 * RUNTIME from `window.location.hostname`, so one image serves localhost, staging, a preview
 * deployment and production. `test/no-build-time-config.test.ts` fails the build if
 * `import.meta.env.VITE_` ever reappears, and the `rules` job in CI greps for it again so that
 * deleting the test does not delete the rule.
 */
export default defineConfig({
  // WHERE ON ANY ORIGIN this bundle lives. Not an environment — the same string everywhere — but a
  // build-time constant regardless, because it goes in front of every hashed asset name in the
  // emitted `index.html`. The trailing slash is required by vite.
  base: '/worlds/aetherholm/',
  plugins: [react()],
  resolve: {
    // @cloudsforge/ui is a `link:` dependency, so its own node_modules holds a second copy of
    // React. Two copies means two dispatchers, and the shared bar would throw on its first
    // useState.
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // The linked package is shipped as TypeScript source until it is published; pre-bundling it
    // would freeze a stale copy of a package that is edited in the same working tree.
    exclude: ['@cloudsforge/ui'],
  },
  build: {
    sourcemap: true,
  },
  // 5171. The design doc allocates this client "vite 517x, collision-checked"
  // (docs/ecosystem/20-aetherholm.md §5), and the collision check is a survey of every sibling's
  // vite.config.ts, not a guess. Taken at the time of writing: 5170 site, 5180 hub-web,
  // 5182 foresight-web, 5183 admin-web, 5184 mint-web, 5185 foresight-admin-web, 5186 trade-web,
  // 5187 market-web, 5188 status-web, 5189 explorer-web, 5190 network-site, 5192 devportal-web,
  // 5195 emberkin-web, 5199 web-template (the deliberate placeholder), and worlds-web on 3001.
  // 5171 collides with none of them and sits in the doc's range.
  //
  // This is a developer convenience and nothing more: it is not the port the app is served on in
  // production, and nothing in the bundle knows about it. The port the app TALKS TO in dev is
  // 4120 — the port micro-aetherholm binds (`aetherholm/src/env.ts`), pinned in the registry
  // (`ui/packages/ui/src/surfaces.ts`) — and that is resolved at runtime by hosts.ts.
  server: { port: 5171 },
  preview: { port: 5171 },
})
