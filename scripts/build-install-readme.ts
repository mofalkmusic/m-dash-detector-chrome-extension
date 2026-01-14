/**
 * Builds INSTALL.md for the zip distribution by extracting
 * the installation section from the main README.md
 */

const HEADER = `# M-Dash Detector - Installation Guide

Thanks for downloading M-Dash Detector! Follow the steps below to install the extension.

`;

const FOOTER = `
---

For more information, visit the [GitHub repository](https://github.com/mofalkmusic/chrome_extension_mdash).
`;

async function buildInstallReadme() {
  const readme = await Bun.file("README.md").text();

  // Extract content between markers
  const startMarker = "<!-- INSTALL_START -->";
  const endMarker = "<!-- INSTALL_END -->";

  const startIndex = readme.indexOf(startMarker);
  const endIndex = readme.indexOf(endMarker);

  if (startIndex === -1 || endIndex === -1) {
    console.error("❌ Could not find INSTALL_START/INSTALL_END markers in README.md");
    process.exit(1);
  }

  const installSection = readme
    .slice(startIndex + startMarker.length, endIndex)
    .trim();

  const installReadme = HEADER + installSection.trim() + FOOTER;

  await Bun.write("INSTALLATION_HELP.txt", installReadme);
  console.log("✓ INSTALLATION_HELP.txt generated");
}

buildInstallReadme();
