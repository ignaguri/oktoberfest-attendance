#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Configuration
const PACKAGE_JSON_PATH = path.join(__dirname, "..", "package.json");
const VERSION_TS_PATH = path.join(__dirname, "..", "version.ts");
const CHANGELOG_TS_PATH = path.join(__dirname, "..", "changelog.ts");

// Get current version from package.json
function getCurrentVersion() {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  return packageJson.version;
}

// Update version in package.json
function updatePackageJson(newVersion) {
  const packageJson = JSON.parse(fs.readFileSync(PACKAGE_JSON_PATH, "utf8"));
  packageJson.version = newVersion;
  fs.writeFileSync(
    PACKAGE_JSON_PATH,
    JSON.stringify(packageJson, null, 2) + "\n",
  );
  console.log(`✅ Updated package.json to version ${newVersion}`);
}

// Update version.ts
function updateVersionTs(newVersion) {
  const content = `export const APP_VERSION = "${newVersion}";\n`;
  fs.writeFileSync(VERSION_TS_PATH, content);
  console.log(`✅ Updated version.ts to version ${newVersion}`);
}

// Generate changelog from conventional commits
function generateChangelog(newVersion) {
  try {
    // Get commits since last tag
    const lastTag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
    }).trim();
    const commits = execSync(`git log ${lastTag}..HEAD --pretty=format:"%s"`, {
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    const changelog = {
      [newVersion]: [],
    };

    commits.forEach((commit) => {
      if (
        commit.match(
          /^(feat|fix|docs|style|refactor|perf|test|chore|breaking):/,
        )
      ) {
        const type = commit.match(/^(\w+):/)[1];
        const description = commit.replace(/^\w+:\s*/, "");

        let emoji = "🔧";
        switch (type) {
          case "feat":
            emoji = "✨";
            break;
          case "fix":
            emoji = "🐛";
            break;
          case "docs":
            emoji = "📚";
            break;
          case "style":
            emoji = "🎨";
            break;
          case "refactor":
            emoji = "♻️";
            break;
          case "perf":
            emoji = "⚡";
            break;
          case "test":
            emoji = "🧪";
            break;
          case "chore":
            emoji = "🔧";
            break;
          case "breaking":
            emoji = "💥";
            break;
        }

        changelog[newVersion].push(`${emoji} ${description}`);
      }
    });

    // Read existing changelog
    let existingChangelog = {};
    try {
      const changelogContent = fs.readFileSync(CHANGELOG_TS_PATH, "utf8");
      // Extract the changelog object from the file
      const match = changelogContent.match(
        /export const changelog: Record<string, string\[\]> = ({[\s\S]*});/,
      );
      if (match) {
        existingChangelog = eval(`(${match[1]})`);
      }
    } catch (error) {
      console.log("⚠️  Could not read existing changelog, creating new one");
    }

    // Merge with existing changelog
    const mergedChangelog = { ...changelog, ...existingChangelog };

    // Generate changelog.ts content
    const changelogContent = `export const changelog: Record<string, string[]> = ${JSON.stringify(mergedChangelog, null, 2)};\n`;
    fs.writeFileSync(CHANGELOG_TS_PATH, changelogContent);
    console.log(
      `✅ Updated changelog.ts with ${changelog[newVersion].length} new entries`,
    );

    return changelog[newVersion];
  } catch (error) {
    console.log(
      "⚠️  Could not generate changelog from commits:",
      error.message,
    );
    // Create empty changelog entry
    const changelog = {
      [newVersion]: ["🔧 Version update"],
    };

    // Read existing changelog
    let existingChangelog = {};
    try {
      const changelogContent = fs.readFileSync(CHANGELOG_TS_PATH, "utf8");
      const match = changelogContent.match(
        /export const changelog: Record<string, string\[\]> = ({[\s\S]*});/,
      );
      if (match) {
        existingChangelog = eval(`(${match[1]})`);
      }
    } catch (error) {
      console.log("⚠️  Could not read existing changelog, creating new one");
    }

    // Merge with existing changelog
    const mergedChangelog = { ...changelog, ...existingChangelog };
    const changelogContent = `export const changelog: Record<string, string[]> = ${JSON.stringify(mergedChangelog, null, 2)};\n`;
    fs.writeFileSync(CHANGELOG_TS_PATH, changelogContent);
    console.log(`✅ Updated changelog.ts with default entry`);

    return changelog[newVersion];
  }
}

function generateInAppChangelog(newVersion) {
  try {
    const lastTag = execSync("git describe --tags --abbrev=0", {
      encoding: "utf8",
    }).trim();

    const allCommits = execSync(
      `git log ${lastTag}..HEAD --pretty=format:"%s"`,
      {
        encoding: "utf8",
      },
    )
      .split("\n")
      .filter(Boolean);

    const filteredCommits = allCommits.filter((commit) =>
      commit.match(/^feat:\s*(.*)/),
    );

    const changelogEntries = [];
    filteredCommits.forEach((commit) => {
      const match = commit.match(/^feat:\s*(.*)/);
      if (match) {
        const description = match[1];
        changelogEntries.push(`✨ ${description}`);
      }
    });

    // Read existing changelog
    let existingChangelog = {};
    try {
      const changelogContent = fs.readFileSync(CHANGELOG_TS_PATH, "utf8");
      const match = changelogContent.match(
        /export const changelog: Record<string, string\[\]> = ({[\s\S]*});/,
      );
      if (match) {
        existingChangelog = eval(`(${match[1]})`);
      }
    } catch (error) {
      console.log("⚠️  Could not read existing changelog.ts, creating new one");
    }

    const mergedChangelog = {
      [newVersion]: changelogEntries,
      ...existingChangelog,
    };
    const changelogContent = `export const changelog: Record<string, string[]> = ${JSON.stringify(mergedChangelog, null, 2)};\n`;
    fs.writeFileSync(CHANGELOG_TS_PATH, changelogContent);
    console.log(
      `✅ Updated changelog.ts with ${changelogEntries.length} new entries`,
    );

    return changelogEntries;
  } catch (error) {
    console.log(
      "⚠️  Could not generate changelog.ts from commits:",
      error.message,
    );
    // Create empty changelog entry
    const defaultEntries = ["🔧 Version update"];
    let existingChangelog = {};
    try {
      const changelogContent = fs.readFileSync(CHANGELOG_TS_PATH, "utf8");
      const match = changelogContent.match(
        /export const changelog: Record<string, string\[\]> = ({[\s\S]*});/,
      );
      if (match) {
        existingChangelog = eval(`(${match[1]})`);
      }
    } catch (error) {
      console.log("⚠️  Could not read existing changelog, creating new one");
    }
    const mergedChangelog = {
      [newVersion]: defaultEntries,
      ...existingChangelog,
    };
    fs.writeFileSync(CHANGELOG_TS_PATH, changelogContent);
    console.log(`✅ Updated changelog.ts with default entry`);
    return defaultEntries;
  }
}

// Main function
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const version = args[1];

  if (!command) {
    console.log("Usage: node scripts/version.js <command> [version]");
    console.log("");
    console.log("Commands:");
    console.log("  patch     Bump patch version (0.0.x)");
    console.log("  minor     Bump minor version (0.x.0)");
    console.log("  major     Bump major version (x.0.0)");
    console.log("  set       Set specific version (e.g., 1.2.3)");
    console.log("  show      Show current version");
    console.log("");
    process.exit(1);
  }

  const currentVersion = getCurrentVersion();
  let newVersion = currentVersion;

  switch (command) {
    case "patch":
      const [major, minor, patch] = currentVersion.split(".").map(Number);
      newVersion = `${major}.${minor}.${patch + 1}`;
      break;
    case "minor":
      const [major2, minor2] = currentVersion.split(".").map(Number);
      newVersion = `${major2}.${minor2 + 1}.0`;
      break;
    case "major":
      const [major3] = currentVersion.split(".").map(Number);
      newVersion = `${major3 + 1}.0.0`;
      break;
    case "set":
      if (!version) {
        console.error("❌ Version required for set command");
        process.exit(1);
      }
      if (!/^\d+\.\d+\.\d+$/.test(version)) {
        console.error(
          "❌ Invalid version format. Use semantic versioning (e.g., 1.2.3)",
        );
        process.exit(1);
      }
      newVersion = version;
      break;
    case "show":
      console.log(currentVersion);
      return;
    default:
      console.error(`❌ Unknown command: ${command}`);
      process.exit(1);
  }

  console.log(`🔄 Updating version from ${currentVersion} to ${newVersion}`);

  // Update files
  updatePackageJson(newVersion);
  updateVersionTs(newVersion);
  const changes = generateChangelog(newVersion);

  console.log("");
  console.log(`🎉 Version updated to ${newVersion}!`);
  console.log(`📝 Changelog entries: ${changes.length}`);
  console.log("");
  console.log("Next steps:");
  console.log("1. Review the changes");
  console.log(
    '2. Commit the changes: git add . && git commit -m "chore: bump version to ${newVersion}"',
  );
  console.log("3. Create a tag: git tag v${newVersion}");
  console.log("4. Push: git push && git push --tags");
  console.log("");
  console.log("Or use the quick release command:");
  if (command === "set") {
    console.log("  pnpm run release:patch");
  } else {
    console.log(`  pnpm run release:${command}`);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  getCurrentVersion,
  updatePackageJson,
  updateVersionTs,
  generateChangelog,
};
