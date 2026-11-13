// A session's transcript as SRT or WebVTT captions. Each utterance is saved when it ends, so a cue ends at its saved
// time and starts where the previous one ended, never more than MAX_CUE_MS earlier. Long utterances split at word
// boundaries into cues of two lines at most, sharing the utterance's time by length.
const MAX_LINE = 42;
const MAX_CUE_MS = 8000;
const MIN_CUE_MS = 1000;

const FORMATS = ['srt', 'vtt'];

function lines(text) {
  const result = [];
  let line = '';
  for (const word of String(text).split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > MAX_LINE) {
      result.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) result.push(line);
  return result;
}

// Cues in milliseconds from the session start, for the transcript entries only, oldest first.
function captionCues(session, labels = {}) {
  const origin = Date.parse(session.started_at);
  const spoken = session.entries
    .filter((entry) => entry.kind === 'transcript' && entry.content.trim())
    .map((entry) => ({ entry, at: Date.parse(entry.created_at) - origin }))
    .filter(({ at }) => Number.isFinite(at) && at >= 0)
    .sort((a, b) => a.at - b.at);
  const cues = [];
  let previous = 0;
  for (const { entry, at } of spoken) {
    const end = Math.max(at, previous + MIN_CUE_MS);
    const start = Math.max(previous, end - MAX_CUE_MS);
    const speaker = entry.speaker === 'ME' ? labels.me : labels.others;
    const pairs = [];
    const split = lines(entry.content);
    for (let i = 0; i < split.length; i += 2) pairs.push(split.slice(i, i + 2));
    const total = pairs.reduce((sum, pair) => sum + pair.join(' ').length, 0);
    let cursor = start;
    pairs.forEach((pair, index) => {
      const share = pair.join(' ').length / total;
      const next = index === pairs.length - 1 ? end : Math.round(cursor + (end - start) * share);
      cues.push({ start: cursor, end: next, speaker: speaker || null, lines: pair });
      cursor = next;
    });
    previous = end;
  }
  return cues;
}

function clock(ms, separator) {
  const pad = (value, size = 2) => String(value).padStart(size, '0');
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}${separator}${pad(ms % 1000, 3)}`;
}

// SRT has no speaker field, so the speaker leads the cue's first line.
function srtCaptions(cues) {
  return cues
    .map((cue, index) => {
      const [first, ...rest] = cue.lines;
      const text = [cue.speaker ? `${cue.speaker}: ${first}` : first, ...rest].join('\n');
      return `${index + 1}\n${clock(cue.start, ',')} --> ${clock(cue.end, ',')}\n${text}\n`;
    })
    .join('\n');
}

// WebVTT names the speaker with a voice span; the text escapes the characters VTT reserves.
function vttCaptions(cues) {
  const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = cues
    .map((cue) => {
      const text = cue.lines.map(escape).join('\n');
      const voiced = cue.speaker ? `<v ${escape(cue.speaker)}>${text}` : text;
      return `${clock(cue.start, '.')} --> ${clock(cue.end, '.')}\n${voiced}\n`;
    })
    .join('\n');
  return `WEBVTT\n\n${body}`;
}

function sessionCaptions(session, format, labels) {
  const cues = captionCues(session, labels);
  return format === 'vtt' ? vttCaptions(cues) : srtCaptions(cues);
}

module.exports = { FORMATS, captionCues, srtCaptions, vttCaptions, sessionCaptions };
