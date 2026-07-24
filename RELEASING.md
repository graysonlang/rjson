# Releasing

Releases are published manually. There is no publish workflow; CI only tests.

## One-time setup

- `npm login` - the scope is published with `publishConfig.access: public`, so a free account is enough. Confirm with `npm whoami`.
- Enable GitHub Pages for the repository (Settings - Pages - Source: GitHub Actions) if the demo at <https://graysonlang.github.io/rjson/> is not live. `.github/workflows/pages.yml` deploys it on every push to `main`.

## Checklist

1. Start from a clean tree on `main`, up to date with `origin`.

   ```sh
   git switch main && git pull && git status
   ```

2. Set the version. Use `--no-git-tag-version` so the tag is created only after the changelog is updated in the same commit.

   ```sh
   npm version <major|minor|patch> --no-git-tag-version
   ```

3. Move the `## [Unreleased]` items in `CHANGELOG.md` under a new version heading with today's date, and update the link definitions at the bottom.

4. Verify. `deploy-test` packs the tarball, installs it into a scratch project, imports it through Node ESM, and type-checks it with strict `tsc` - it is the check that matters most before publishing.

   ```sh
   npm ci
   npm test
   npm run lint
   npm run build
   npm run deploy-test
   ```

5. Inspect exactly what will ship. It should be `package.json`, `README.md`, `LICENSE.md`, `src/rjson.js`, and `src/rjson.d.ts` - nothing else.

   ```sh
   npm pack --dry-run
   ```

6. Commit, tag, and push.

   ```sh
   git commit -am "vX.Y.Z"
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin main --follow-tags
   ```

7. Wait for CI to pass on the pushed commit.

8. Publish.

   ```sh
   npm publish
   ```

   Add `--provenance` only from a GitHub Actions run; it fails locally because it needs an OIDC token from a CI environment.

9. Confirm the published package resolves and contains what you expect.

   ```sh
   npm view @graysonlang/rjson version
   ```

10. Create the GitHub release from the tag, pasting that version's changelog section as the body.

    ```sh
    gh release create vX.Y.Z --title vX.Y.Z --notes-file - <<'EOF'
    (paste the changelog section)
    EOF
    ```

## If a publish goes wrong

`npm unpublish` is only allowed within 72 hours and permanently burns the version number. Prefer publishing a patch release over unpublishing. To stop a bad version from being installed as `latest` without removing it:

```sh
npm dist-tag add @graysonlang/rjson@<last-good-version> latest
npm deprecate @graysonlang/rjson@<bad-version> "Broken release, use <last-good-version>"
```
