const path = require('node:path');

// Native helpers ship in the app's resources when packaged and are built into .local/native during development.
function nativeHelperPaths({ packaged, resourcesPath, root }) {
  return (name) => (packaged ? path.join(resourcesPath, 'native', name) : path.resolve(root, '.local/native', name));
}
module.exports = { nativeHelperPaths };
