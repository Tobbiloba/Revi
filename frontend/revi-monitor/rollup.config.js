import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default [
  // Core SDK - ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist'
      }),
      production && terser()
    ]
  },
  // Core SDK - CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      }),
      production && terser()
    ]
  },
  // React Components - ES Module build
  {
    input: 'src/react/index.ts',
    external: ['react', 'react-dom'],
    output: {
      file: 'dist/react/index.esm.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: true,
        declarationDir: './dist/react'
      }),
      production && terser()
    ]
  },
  // React Components - CommonJS build
  {
    input: 'src/react/index.ts',
    external: ['react', 'react-dom'],
    output: {
      file: 'dist/react/index.js',
      format: 'cjs',
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      }),
      production && terser()
    ]
  },
  // UMD build for CDN
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/revi-monitor.umd.js',
      format: 'umd',
      name: 'ReviMonitor',
      sourcemap: true
    },
    plugins: [
      resolve({
        browser: true,
        preferBuiltins: false
      }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json'
      }),
      production && terser()
    ]
  }
];
