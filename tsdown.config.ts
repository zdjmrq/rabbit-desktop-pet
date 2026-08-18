import { defineConfig } from 'tsdown'
import { readFileSync } from 'node:fs'

export default defineConfig({
  entry: { renderer: 'src/renderer.ts' },
  outDir: 'dist',
  format: 'iife',
  platform: 'browser',
  target: 'es2022',
  clean: true,
  dts: false,
  sourcemap: false,
  minify: true,
  noExternal: () => true,
  plugins: [{
    name: 'inline-desktop-pet-assets',
    load(id) {
      if (!id.endsWith('.png')) return null
      const source = `data:image/png;base64,${readFileSync(id).toString('base64')}`
      return { code: `export default ${JSON.stringify(source)}`, moduleType: 'js' }
    },
  }],
  outputOptions: { entryFileNames: 'renderer.js' },
})
