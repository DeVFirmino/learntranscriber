function text(value, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max)
    throw new Error('Enter valid text within the length limit.');
  return value.trim();
}
module.exports = { text };
