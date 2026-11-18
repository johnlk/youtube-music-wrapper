module.exports = async function signMacAdHoc(options) {
  // @electron/osx-sign 2 is ESM-only and renamed signAsync to sign.
  const { sign } = await import("@electron/osx-sign");
  const callerOptionsForFile = options.optionsForFile;

  const signOptions = {
    app: options.app,
    platform: options.platform,
    type: options.type,
    version: options.version,
    identity: "-",
    identityValidation: false,
    binaries: options.binaries,
    preAutoEntitlements: options.preAutoEntitlements,
    provisioningProfile: options.provisioningProfile,
    // osx-sign enables --timestamp unless a per-file timestamp is set.
    // Ad-hoc signatures cannot be timestamped.
    optionsForFile(filePath, context) {
      const perFile = callerOptionsForFile ? callerOptionsForFile(filePath, context) : {};
      return {
        ...perFile,
        timestamp: "none",
      };
    },
  };

  if (options.strictVerify === false || typeof options.strictVerify === "string") {
    signOptions.strictVerify = options.strictVerify;
  }

  await sign(signOptions);
};
