// openapi-typescript calls the TS compiler API at import, which TS 7 does not
// ship. Swap its typescript peer for its own TypeScript 5 dependency so the
// rest of the workspace can stay on TS 7.
function readPackage(pkg) {
  if (pkg.name === "openapi-typescript") {
    delete pkg.peerDependencies?.typescript;
    pkg.dependencies = { ...pkg.dependencies, typescript: "5.9.3" };
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
