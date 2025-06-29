import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';

const external = ['@mlc-ai/web-llm', 'eventemitter3'];

export default [
  // Build bundles
  {
    input: 'src/index.ts',
    external,
    output: [
      {
        file: 'dist/index.cjs',
        format: 'cjs',
        sourcemap: true
      },
      {
        file: 'dist/index.esm.js',
        format: 'esm',
        sourcemap: true
      },
      {
        file: 'dist/index.umd.js',
        format: 'umd',
        name: 'WebLLMAgent',
        sourcemap: true,
        globals: {
          '@mlc-ai/web-llm': 'WebLLM',
          'eventemitter3': 'EventEmitter'
        }
      }
    ],
    plugins: [
      resolve({ browser: true }),
      commonjs(),
      typescript({ 
        sourceMap: true,
        declaration: false,
        exclude: ['**/*.test.ts']
      })
    ]
  },
  // Build type definitions
  {
    input: 'src/index.ts',
    external,
    output: {
      file: 'dist/index.d.ts',
      format: 'esm'
    },
    plugins: [dts()]
  }
];