import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

const sharedPlugins = [
  resolve({
    browser: true,
    preferBuiltins: false
  }),
  commonjs(),
];

const terserConfig = {
  module: true,
  toplevel: true,
  mangle: {
    properties: {
      regex: /^_/
    }
  },
  compress: {
    module: true,
    toplevel: true,
    unsafe_arrows: true,
    drop_console: production,
    drop_debugger: production,
    pure_getters: true,
    unsafe: true,
    unsafe_comps: true,
    unsafe_Function: true,
    unsafe_math: true,
    unsafe_symbols: true,
    unsafe_methods: true,
    unsafe_proto: true,
    unsafe_regexp: true,
    unsafe_undefined: true,
    passes: 2
  }
};

export default [
  // Core SDK - ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  },
  // Core SDK - CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
      exports: 'auto'
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json'
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  },
  // React Components - ES Module build
  {
    input: 'src/react/index.ts',
    external: ['react', 'react-dom'],
    output: {
      file: 'dist/react/index.esm.js',
      format: 'es',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/react',
        exclude: ['**/*.tsx'] // Skip TSX files to avoid JSX issues
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  },
  // React Components - CommonJS build
  {
    input: 'src/react/index.ts',
    external: ['react', 'react-dom'],
    output: {
      file: 'dist/react/index.js',
      format: 'cjs',
      sourcemap: true,
      inlineDynamicImports: true,
      exports: 'auto'
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        exclude: ['**/*.tsx'] // Skip TSX files to avoid JSX issues
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  },
  // UMD build for CDN
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/revi-monitor.umd.js',
      format: 'umd',
      name: 'ReviMonitor',
      sourcemap: true,
      inlineDynamicImports: true
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json'
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  },
  // Session Replay module (lazy-loadable)
  {
    input: 'src/session-replay.ts',
    output: {
      file: 'dist/session-replay.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  },
  // Performance Monitor module (lazy-loadable)
  {
    input: 'src/performance-monitor.ts',
    output: {
      file: 'dist/performance-monitor.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      ...sharedPlugins,
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      }),
      production && terser(terserConfig)
    ],
    treeshake: {
      moduleSideEffects: false,
      propertyReadSideEffects: false,
      unknownGlobalSideEffects: false
    }
  }
];
