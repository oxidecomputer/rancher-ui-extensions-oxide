import { importTypes } from '@rancher/auto-import';
import { IPlugin } from '@shell/core/types';

export default function(plugin: IPlugin): void {
  importTypes(plugin);

  plugin.metadata = require('./package.json');

  // This specifically sets the icon for the node driver, not the extension itself.
  plugin.register('image', 'providers/oxide.svg', 'https://oxide.computer/img/press/wordmark-black.svg');
}
