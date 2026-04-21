import { rspack } from '@rspack/core'
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

function createExternals() {
  return [({ request }, callback) => {
    if (isExternalRequest(request)) {
      callback(null, request)
      return
    }
    callback()
  }]
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

function createNodeLibraryConfig({ clean = false } = {}) {
  return {
    ...commonConfig,
    name: 'node-library',
    target: 'node18',
    entry: {
      index: './src/index.ts',
    },
    output: {
      path: resolve(packageDir, 'dist'),
      clean,
      filename: '[name].cjs',
      chunkFilename: 'chunks/[name]-[contenthash:8].cjs',
      chunkFormat: 'commonjs',
      chunkLoading: 'require',
      workerChunkLoading: 'require',
      library: {
        type: 'commonjs-static',
      },
    },
    externalsType: 'commonjs',
    externals: createExternals(),
  }
}

function createCliConfig() {
  return {
    ...commonConfig,
    name: 'cli',
    target: 'node18',
    entry: {
      cli: './src/cli.ts',
    },
    output: {
      path: resolve(packageDir, 'dist'),
      clean: false,
      filename: '[name].cjs',
      chunkFilename: 'chunks/[name]-[contenthash:8].cjs',
      chunkFormat: 'commonjs',
      chunkLoading: 'require',
      workerChunkLoading: 'require',
    },
    externalsType: 'commonjs',
    externals: createExternals(),
    plugins: [
      new rspack.BannerPlugin({
        banner: '#!/usr/bin/env node',
        raw: true,
        entryOnly: true,
      }),
    ],
  }
}

function createBrowserConfig() {
  return {
    ...commonConfig,
    name: 'browser',
    target: 'web',
    entry: {
      browser: './src/browser.ts',
      'runtime/hydrate-support-proxy': './src/runtime/hydrate-support-proxy.ts',
    },
    output: {
      path: resolve(packageDir, 'dist'),
      clean: false,
      filename: '[name].js',
      chunkFilename: 'chunks/[name]-[contenthash:8].js',
      module: true,
      chunkFormat: 'module',
      chunkLoading: 'import',
      workerChunkLoading: 'import',
      library: {
        type: 'modern-module',
      },
    },
    externalsType: 'module-import',
    externals: createExternals(),
  }
}

export default (env = {}) => {
  const clean = env.clean === true || env.clean === 'true'

  switch (env.kind) {
    case 'node-library':
      return createNodeLibraryConfig({ clean })
    case 'cli':
      return createCliConfig()
    case 'browser':
      return createBrowserConfig()
    default:
      return [
        createNodeLibraryConfig(),
        createCliConfig(),
        createBrowserConfig(),
      ]
  }
}
