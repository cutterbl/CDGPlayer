import path from 'path';
import * as url from 'url';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import eslint from '@rollup/plugin-eslint';
import clear from 'rollup-plugin-clear';
import cleanup from 'rollup-plugin-cleanup';
import html from 'rollup-plugin-html';
import postcss from 'rollup-plugin-postcss';
import terser from '@rollup/plugin-terser';
import pkg from '../package.json' assert { type: 'json' };

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

export default [
  {
    input: path.join(__dirname, '../src/index.js'),
    output: [
      {
        file: pkg.module,
        format: 'esm',
        banner: `
/**
 *  @package CDGPlayer 
 *  @version ${pkg.version}
 *  @license GPLv3
 *  @copyright Copyright (c) 2018 ${pkg.author.name}
 *  @author ${pkg.author.name} - ${pkg.author.url}
 *
 *  This library is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This library is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this library.  If not, see <http://www.gnu.org/licenses/>.
 *
 *  @package IcoFont
 *  @version 1.0.1
 *  @author IcoFont https://icofont.com
 *  @copyright Copyright (c) 2015 - 2018 IcoFont
 *  @license - https://icofont.com/license/
 *  (For the 'play' and 'pause' buttons, which are the only ones included)
 */
                `,
        sourcemap: true,
        exports: 'named',
        globals: {
          JSZip: 'JSZip',
          JSZipUtils: 'JSZipUtils',
          jsmediatags: 'jsmediatags',
        },
      },
    ],
    external: ['JSZip', 'JSZipUtils', 'jsmediatags'],
    plugins: [
      clear({
        targets: ['dist'],
        watch: true,
      }),
      postcss({
        minimize: true,
        config: {
          path: path.resolve(__dirname, './postcss.config.js'),
        },
      }),
      html({
        htmlMinifierOptions: {
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
          conservativeCollapse: true,
        },
      }),
      eslint({
        overrideConfig: {
          globals: {
            JSZip: 'readonly',
            JSZipUtils: 'readonly',
            jsmediatags: 'readonly',
          },
          parser: '@babel/eslint-parser',
          parserOptions: {
            sourceType: 'module',
            ecmaVersion: 2021,
            babelOptions: {
              configFile: path.resolve(__dirname, './babel.config.json'),
            },
          },
          rules: {
            indent: ['error', 2, { SwitchCase: 1 }],
            'linebreak-style': ['error', 'unix'],
            quotes: [
              'error',
              'single',
              { avoidEscape: true, allowTemplateLiterals: true },
            ],
            semi: ['error', 'always'],
          },
        },
        exclude: [/node_modules/, /soundtouchjs/, /jszip/, /\.scss/, /\.html/],
      }),
      babel({
        babelHelpers: 'bundled',
        configFile: path.resolve(__dirname, './babel.config.json'),
      }),
      resolve({
        browser: true,
      }),
      commonjs({
        includes: ['node_modules/proxy-observable/bin/proxy.observable.es6.js'],
      }),
      terser({
        output: {
          comments: function (node, comment) {
            const { value, type } = comment;
            if (type === 'comment2') {
              return /@preserve|@license|@cc_on/i.test(value);
            }
          },
        },
      }),
      cleanup(),
    ],
  },
];
