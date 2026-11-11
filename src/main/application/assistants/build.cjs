// One assistant-builder turn on the configured model, through a local lease when the provider is local.
// Its proposals are registered so only they can be applied later.
function createAssistantBuild({ settings, builder, route, proposals }) {
  return {
    async build(input, signal) {
      const result = await route.run(settings(), (chosen) => builder().build(chosen, input, signal), { signal });
      proposals.issue(result?.proposals);
      return result;
    },
  };
}
module.exports = { createAssistantBuild };
