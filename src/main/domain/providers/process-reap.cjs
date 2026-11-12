// `ps -o command=` reports the whole command line, not just the executable, so a recorded path matches only
// when it is the entire command or is followed by a space and its arguments. A bare prefix match would wrongly
// treat "/usr/bin/foo" as the same program as "/usr/bin/foobar", and the OS can reuse a pid for an unrelated
// program once the one that held it exits, so a command that no longer starts with the recorded path must be
// left alone rather than killed.
function commandMatchesExecutable(command, executable) {
  const trimmed = typeof command === 'string' ? command.trim() : '';
  return Boolean(trimmed) && (trimmed === executable || trimmed.startsWith(`${executable} `));
}

module.exports = { commandMatchesExecutable };
