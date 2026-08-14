import convexPlugin from '@convex-dev/eslint-plugin'
import { tanstackConfig } from '@tanstack/eslint-config'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  ...tanstackConfig,
  ...convexPlugin.configs.recommended,
  globalIgnores(['convex/_generated', 'convex/types', 'src/routeTree.gen.ts']),
])
