// One capture at a time, with the same truthful progress published to every app window.
function createScreenCapture({ captureImage, changed }) {
  let pending = null;
  return {
    capture() {
      if (pending) return pending;
      changed({ phase: 'capturing' });
      pending = Promise.resolve()
        .then(captureImage)
        .then(
          (image) => {
            changed({ phase: 'captured' });
            return image;
          },
          (error) => {
            changed({ phase: 'error' });
            throw error;
          },
        )
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}
module.exports = { createScreenCapture };
