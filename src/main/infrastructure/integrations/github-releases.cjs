// Reads a repository's latest GitHub release through the public, unauthenticated REST API. `/releases/latest`
// already excludes drafts and prereleases, but their flags still come back for the caller to check again.
function githubReleases({ fetch }) {
  return {
    async latestRelease(slug, { userAgent, signal } = {}) {
      const response = await fetch(`https://api.github.com/repos/${slug}/releases/latest`, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': userAgent },
        signal: signal || AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error(`GitHub releases returned HTTP ${response.status}.`);
      const body = await response.json();
      return {
        tagName: String(body.tag_name || ''),
        htmlUrl: String(body.html_url || ''),
        draft: Boolean(body.draft),
        prerelease: Boolean(body.prerelease),
      };
    },
  };
}
module.exports = { githubReleases };
