const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const { join, resolve } = require('path');

// NestJS optional peer deps that may not be installed — ignore them at bundle time.
// NestJS wraps these requires in try/catch so the app runs fine without them.
const NESTJS_OPTIONAL_LAZY_IMPORTS = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets/socket-module',
  'class-transformer/storage',
];

module.exports = {
  output: {
    path: join(__dirname, '../../dist/api'),
    clean: process.env.NODE_ENV === 'production',
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  externals: [
    nodeExternals({
      allowlist: [/^@svx\//],
      modulesDir: resolve(__dirname, '../../node_modules'),
    }),
  ],
  plugins: [
    new webpack.IgnorePlugin({
      checkResource(resource) {
        if (!NESTJS_OPTIONAL_LAZY_IMPORTS.includes(resource)) return false;
        try {
          require.resolve(resource);
          return false;
        } catch {
          return true;
        }
      },
    }),
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: false,
      sourceMap: true,
      externalDependencies: 'none',
      skipTypeChecking: true,
    }),
  ],
};
