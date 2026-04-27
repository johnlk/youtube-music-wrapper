# Release Flow

## PR Checks

The PR workflow runs when a pull request is opened, updated, reopened, or marked ready for review. It uses the same package manager and validation commands as local development:

```sh
bun install --frozen-lockfile
git diff --check <base> HEAD
bun run typecheck
bun run build
```

This keeps PR validation fast while still proving the Electron TypeScript app compiles.

## macOS Release

Yes, GitHub Actions can publish the generated `.dmg`. The release workflow runs on macOS, builds the app with `electron-builder`, then attaches the generated `release/*.dmg` and `release/*.zip` files to a GitHub Release.

The workflow runs automatically when a `v*` tag is pushed:

```sh
git checkout main
git pull --ff-only origin main
# Update package.json to the release version, then commit that change.
bun install --frozen-lockfile
bun run typecheck
bun run build
bun run package:mac
git tag -a v0.1.0 -m "v0.1.0"
git push origin main
git push origin v0.1.0
```

After the tag push, GitHub Actions creates or updates the GitHub Release and uploads the macOS artifacts. The workflow can also be run manually from GitHub Actions by choosing the `Release` workflow and entering a release tag such as `v0.1.0`.

## Signing and Notarization

The current workflow sets `CSC_IDENTITY_AUTO_DISCOVERY=false`, so the CI build can produce unsigned personal-use artifacts without Apple Developer certificates. macOS may show the unsigned-app warning documented in the README.

Before distributing the app broadly, add Developer ID signing and Apple notarization secrets, then remove the unsigned-build assumption from the workflow.
