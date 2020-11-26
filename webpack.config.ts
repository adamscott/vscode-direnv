import type { Program, TransformerFactory, SourceFile } from 'typescript'
import type { Configuration } from 'webpack'

import * as path from 'path'
import transcriptIsTransformer from 'typescript-is/lib/transform-inline/transformer'

const config: Configuration = {
  target: 'node',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
    devtoolModuleFilenameTemplate: '../[resource-path]'
  },
  devtool: 'source-map',
  externals: {
    vscode: 'commonjs vscode'
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/u,
        exclude: /node_modules/u,
        use: [
          {
            loader: 'ts-loader',
            options: {
              getCustomTransformers: (program: Program): { before: TransformerFactory<SourceFile>[] } => ({
                before: [transcriptIsTransformer(program)]
              })
            }
          }
        ]
      }
    ]
  }
}

export default config
