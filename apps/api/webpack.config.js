const { composePlugins, withNx } = require('@nx/webpack');
const nodeExternals = require('webpack-node-externals');
const webpack = require('webpack');
const { join, resolve } = require('path');

const NESTJS_OPTIONAL_LAZY_IMPORTS = [
  '@nestjs/microservices',
  '@nestjs/microservices/microservices-module',
  '@nestjs/websockets/socket-module',
  'class-transformer/storage',
];

module.exports = composePlugins(withNx(), (config) => {
  config.module ??= {};
  config.module.rules ??= [];
  config.module.rules.unshift({
    test: /\.ts$/,
    exclude: /node_modules/,
    enforce: 'pre',
    loader: resolve(__dirname, '../../tools/ts-descriptor-transformer/webpack-loader.js'),
  });

  config.output = {
    path: join(__dirname, '../../dist/api'),
    clean: process.env.NODE_ENV === 'production',
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  };

  config.externals = [
    nodeExternals({
      allowlist: [/^@svx\//],
      modulesDir: resolve(__dirname, '../../node_modules'),
    }),
  ];

  config.plugins.push(
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
  );

  config.watchOptions = {
    aggregateTimeout: 300,
    poll: 1000,
    ignored: /node_modules/,
  };

  return config;
});
