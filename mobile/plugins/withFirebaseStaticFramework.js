const { withPodfile } = require('@expo/config-plugins');

module.exports = function withFirebaseStaticFramework(config) {
  return withPodfile(config, (config) => {
    const contents = config.modResults.contents;
    config.modResults.contents = contents.replace(
      /(target '.+' do)/,
      "$1\n  $RNFirebaseAsStaticFramework = true"
    );
    return config;
  });
};
