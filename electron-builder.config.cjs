module.exports = {
  appId: 'com.keecor.yugiohlegend',
  productName: 'YugiohLegend',
  directories: { output: 'release' },
  files: ['electron/**/*', '**/*', '!node_modules/**/*', '!release/**/*', '!.git/**/*', '!_temp/**/*', 'steam_appid.txt'],
  win: { target: ['nsis', 'portable'], signAndEditExecutable: false },
  nsis: { artifactName: 'YugiohLegend_v${version}_setup.exe', oneClick: false, allowToChangeInstallationDirectory: true },
  portable: { artifactName: 'YugiohLegend_v${version}_portable.exe' },
};
