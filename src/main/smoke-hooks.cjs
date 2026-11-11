const smokeTest = require('./smoke.cjs');

// The Electron smoke test drives the composed application through its internals. `--smoke-test` passes these
// hooks to the composition; production composes the same application without them.
function smokeHooks({ run = smokeTest.run } = {}) {
  let capture = null;
  return {
    // Screenshots come from the substitute capture the smoke installs, if any.
    screenshot: (real) => () => (capture ?? real)(),
    run: ({ windows, notchState, active, ...internals }) =>
      run({
        ...internals,
        mainWindow: windows.main(),
        createWindow: (role) => windows.create(role),
        expandNotch: (expanded) => windows.setNotchExpanded(expanded),
        getNotchDisplay: () => notchState.snapshot(),
        setActive: (id) => active.set(id),
        setCapture(substitute) {
          const previous = capture;
          capture = substitute;
          return () => {
            capture = previous;
          };
        },
      }),
  };
}
module.exports = { smokeHooks };
