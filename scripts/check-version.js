#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

/**
 * Reads a UTF-8 project source file relative to the repository root.
 * @param {string} rootPath Absolute repository root path.
 * @param {string} relativePath Source file path relative to the root.
 * @returns {string} Complete file contents.
 */
function readProjectFile(rootPath, relativePath) {
  return fs.readFileSync(path.join(rootPath, relativePath), "utf8");
}

/**
 * Extracts the app and cache versions from the central version declaration.
 * @param {string} source Contents of version.js.
 * @returns {{appVersion: string, cacheVersion: string}|null} Parsed versions, or null when the declaration is invalid.
 */
function readVersionInfo(source) {
  const appVersionMatch = source.match(/appVersion:\s*"(\d+\.\d+\.\d+)"/u);
  const cacheVersionMatch = source.match(/cacheVersion:\s*"(v\d+)"/u);
  if (!appVersionMatch || !cacheVersionMatch) return null;
  return { appVersion: appVersionMatch[1], cacheVersion: cacheVersionMatch[1] };
}

/**
 * Adds an error when a required source fragment is missing.
 * @param {string[]} errors Mutable list of reported check failures.
 * @param {string} source Source text to inspect.
 * @param {string} requiredFragment Required literal source fragment.
 * @param {string} message Failure message when the fragment is absent.
 * @returns {void}
 */
function requireSourceFragment(errors, source, requiredFragment, message) {
  if (!source.includes(requiredFragment)) errors.push(message);
}

/**
 * Checks the central version values and every runtime consumer that must load them.
 * @returns {void} Prints a success report or exits with a failing status.
 */
function main() {
  const rootPath = path.resolve(__dirname, "..");
  const versionSource = readProjectFile(rootPath, "version.js");
  const appSource = readProjectFile(rootPath, "app.js");
  const serviceWorkerSource = readProjectFile(rootPath, "sw.js");
  const htmlSource = readProjectFile(rootPath, "index.html");
  const errors = [];
  const versionInfo = readVersionInfo(versionSource);
  if (!versionInfo) {
    errors.push("version.js must define appVersion as X.Y.Z and cacheVersion as vN.");
  } else {
    if (versionInfo.appVersion === "0.0.0") errors.push("appVersion must not use the placeholder 0.0.0.");
    if (versionInfo.cacheVersion === "v0") errors.push("cacheVersion must not use the placeholder v0.");
  }
  requireSourceFragment(errors, appSource, "globalThis.APP_VERSION_INFO", "app.js must read APP_VERSION_INFO from version.js.");
  requireSourceFragment(errors, serviceWorkerSource, "importScripts(\"./version.js\")", "sw.js must load version.js before constructing its cache name.");
  requireSourceFragment(errors, serviceWorkerSource, "const APP_VERSION = globalThis.APP_VERSION_INFO?.cacheVersion", "sw.js must derive its cache version from APP_VERSION_INFO.");
  const versionScriptIndex = htmlSource.indexOf('<script src="version.js"></script>');
  const appScriptIndex = htmlSource.indexOf('<script src="app.js" type="module"></script>');
  if (versionScriptIndex < 0) errors.push("index.html must load version.js.");
  if (appScriptIndex < 0) errors.push("index.html must load app.js as a module.");
  if (versionScriptIndex >= appScriptIndex && appScriptIndex >= 0) errors.push("index.html must load version.js before app.js.");
  if (errors.length) {
    console.error("Version check failed:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Version check passed. appVersion ${versionInfo.appVersion}, cacheVersion ${versionInfo.cacheVersion}.`);
}

main();
