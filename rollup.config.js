import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import babel from 'rollup-plugin-babel';
import clear from 'rollup-plugin-clear';
import { eslint } from 'rollup-plugin-eslint';
import cleanup from 'rollup-plugin-cleanup';
import html from 'rollup-plugin-html';
import postcss from 'rollup-plugin-postcss';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

export default [
  {
    input: 'src/index.js',
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
          jsmediatags: 'jsmediatags'
        }
      }
    ],
    external: ['JSZip', 'JSZipUtils', 'jsmediatags'],
    plugins: [
      clear({
        targets: ['dist'],
        watch: true
      }),
      postcss({
        minimize: true,
        config: {
          path: './postcss.config.js'
        }
      }),
      html({
        htmlMinifierOptions: {
          collapseWhitespace: true,
          collapseBooleanAttributes: true,
          conservativeCollapse: true
        }
      }),
      eslint({
        exclude: [/node_modules/, /soundtouchjs/, /jszip/, /\.scss/, /\.html/]
      }),
      babel({
        babelrc: false,
        plugins: ['external-helpers', 'babel-plugin-transform-class-properties'],
        presets: [
          [
            'env',
            {
              modules: false,
              targets: {
                browsers: ['ie >= 10']
              }
            }
          ]
        ]
      }),
      resolve({
        browser: true
      }),
      commonjs({
        includes: ['node_modules/proxy-observable/bin/proxy.observable.es6.js'],
        namedExports: {
          'node_modules/proxy-observable/bin/proxy.observable.es6.js': 'observable'
        }
      }),
      terser({
        output: {
          comments: function(node, comment) {
            const { value, type } = comment;
            if (type === 'comment2') {
              return /@preserve|@license|@cc_on/i.test(value);
            }
          }
        }
      }),
      cleanup()
    ]
  }
];
