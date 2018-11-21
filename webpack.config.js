module.exports = {
  mode: 'none',
  devtool: 'source-map',
  entry: __dirname + '/src/deferer-queue.js',
  output: {
    path: __dirname + '/dist',
    filename: 'deferer-queue.js',
    library: 'deferer-queue',
    libraryTarget: 'umd',
    globalObject: 'typeof window !== undefined ? window : typeof global !== undefined ? global : typeof self !== undefined ? self : this',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: 'babel-loader',
      },
    ],
  },
  optimization: {
    minimize: false,
    usedExports: true,
    sideEffects: true,
  },
}
