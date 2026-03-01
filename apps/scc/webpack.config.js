const path = require('path');

module.exports = function (options, webpack) {
  // Native Module, die nicht gebundelt werden sollen
  const nativeModules = ['bcrypt', 'pg', 'pg-native'];
  
  // Neue Webpack 5 Syntax für externals (behebt Deprecation-Warnung)
  const externalsFunction = ({ context, request }, callback) => {
    // Prüfe, ob es ein natives Modul ist
    if (nativeModules.includes(request)) {
      return callback(null, `commonjs ${request}`);
    }
    
    // Fallback zu bestehenden externals, falls vorhanden
    if (options.externals) {
      if (typeof options.externals === 'function') {
        return options.externals({ context, request }, callback);
      }
      if (Array.isArray(options.externals)) {
        for (const external of options.externals) {
          if (typeof external === 'function') {
            const result = external({ context, request }, callback);
            if (result !== undefined) return result;
          }
        }
      }
    }
    
    callback();
  };

  return {
    ...options,
    resolve: {
      ...options.resolve,
      alias: {
        ...options.resolve?.alias,
        '@saivaro/shared': path.resolve(__dirname, '../../packages/shared/dist/index.js'),
      },
      symlinks: false, // Wichtig für pnpm Workspaces
    },
    externals: externalsFunction,
    // Stelle sicher, dass node_modules nicht gebundelt werden
    node: {
      __dirname: false,
      __filename: false,
    },
    // Ignoriere native Module beim Bundling
    target: 'node',
  };
};

