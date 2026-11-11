// Automatic requests retry on their own, so each distinct failure is reported at most once per window of time.
function throttleFailures(report, { now, windowMs = 60000 }) {
  let last = { message: '', at: 0 };
  return (message) => {
    const at = now();
    if (last.message === message && at - last.at < windowMs) return;
    last = { message, at };
    report(message);
  };
}
module.exports = { throttleFailures };
