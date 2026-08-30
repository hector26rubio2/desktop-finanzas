const platform = process.argv[2];
const missing = [];

function requireAny(label, groups) {
  if (!groups.some((group) => group.every((name) => Boolean(process.env[name])))) missing.push(label);
}

if (!['win', 'mac', 'linux', 'publish'].includes(platform)) {
  throw new Error('Usage: node scripts/verify-release-env.mjs <win|mac|linux|publish>');
}

if (platform === 'win' || platform === 'publish') {
  requireAny('Windows signing certificate', [
    ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD'],
    ['CSC_LINK', 'CSC_KEY_PASSWORD'],
  ]);
}

if (platform === 'mac' || (platform === 'publish' && process.platform === 'darwin')) {
  requireAny('macOS signing certificate', [['CSC_LINK', 'CSC_KEY_PASSWORD']]);
  requireAny('Apple notarization credentials', [
    ['APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID'],
    ['APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
  ]);
}

if (platform === 'publish' && !process.env['GH_TOKEN']) missing.push('GH_TOKEN');

if (process.env['GITHUB_REF_NAME']) {
  const { readFileSync } = await import('node:fs');
  const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  if (process.env['GITHUB_REF_NAME'] !== `v${version}`) missing.push(`tag v${version}`);
}

if (missing.length > 0) {
  throw new Error(`Release blocked: missing ${missing.join(', ')}.`);
}

process.stdout.write(`Release prerequisites verified for ${platform}.\n`);
