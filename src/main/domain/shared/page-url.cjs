// The page a URL names, without its query or fragment: every window loads the same renderer page with its own query.
const pageOf = (url) => url.split('#')[0].split('?')[0];

module.exports = { pageOf };
