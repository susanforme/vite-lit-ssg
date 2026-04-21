import { readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageDir = dirname(fileURLToPath(import.meta.url))
const packageJson = JSON.parse(readFileSync(resolve(packageDir, 'package.json'), 'utf-8'))
const externalPackages = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.peerDependencies ?? {}),
])
const builtins = new Set([
  ...builtinModules,
  ...builtinModules.map((name) => `node:${name}`),
])

function isExternalRequest(request) {
  if (!request) return false
  if (builtins.has(request)) return true
  for (const packageName of externalPackages) {
    if (request === packageName || request.startsWith(`${packageName}/`)) {
      return true
    }
  }
  return false
}

const commonConfig = {
  context: packageDir,
  mode: 'production',
  devtool: 'source-map',
  resolve: {
    extensions: ['.ts', '.js'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        loader: 'builtin:swc-loader',
        options: {
          sourceMaps: true,
          jsc: {
            target: 'es2022',
            parser: {
              syntax: 'typescript',
              decorators: true,
              dynamicImport: true,
            },
          },
        },
        type: 'javascript/esm',
      },
    ],
  },
  optimization: {
    minimize: false,
    splitChunks: false,
    runtimeChunk: false,
    concatenateModules: true,
    avoidEntryIife: true,
  },
}

const nodeLibraryConfig = {
  ...commonConfig,
  target: 'node18',
  entry: {
    index: './src/index.ts',
    browser: './src/browser.ts',
    cli: './src/cli.ts',
  },
  output: {
    path: resolve(packageDir, 'dist'),
    clean: true,
    filename: '[name].js',
    chunkFilename: 'chunks/[name]-[contenthash:8].js',
    module: true,
    chunkFormat: 'module',
    chunkLoading: 'import',
    workerChunkLoading: 'import',
    library: {
      type: 'module',
    },
  },
  externalsType: 'module',
  externals: [({ request }, callback) => {
    if (isExternalRequest(request)) {
      callback(null, request)
      return
    }
    callback()
  }],
}

export default nodeLibraryConfig
