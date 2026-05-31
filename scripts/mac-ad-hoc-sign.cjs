const { signAsync } = require("@electron/osx-sign");

module.exports = async function signMacAdHoc(options) {
  const signOptions = {
    app: options.app,
    platform: options.platform,
    type: options.type,
    version: options.version,
    identity: "-",
    identityValidation: false,
    binaries: options.binaries,
    optionsForFile: options.optionsForFile,
    preAutoEntitlements: options.preAutoEntitlements,
    provisioningProfile: options.provisioningProfile,
  };

  if (options.strictVerify === false || typeof options.strictVerify === "string") {
    signOptions.strictVerify = options.strictVerify;
  }

  await signAsync(signOptions);
};
