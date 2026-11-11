const { randomUUID } = require('node:crypto');
const { text } = require('../../domain/shared/text.cjs');

const KINDS = ['transcript', 'user', 'assistant'];

function entryRepository({ db, sessions }) {
  const segment = (sessionId, segmentId) =>
    db.prepare('SELECT * FROM entries WHERE session_id=? AND segment_id=?').get(sessionId, segmentId) || null;
  return {
    segment,
    // A segment id makes a transcript append idempotent: replaying it returns the stored entry.
    add(sessionId, kind, content, speaker = '', segmentId = null, generation = null) {
      sessions.get(sessionId);
      if (!KINDS.includes(kind)) throw new Error('Invalid entry kind.');
      if (kind === 'transcript' && !['ME', 'THEY'].includes(speaker)) throw new Error('Invalid speaker.');
      if (segmentId !== null && (typeof segmentId !== 'string' || !segmentId || segmentId.length > 100))
        throw new Error('Invalid audio segment.');
      if (
        generation !== null &&
        (!generation ||
          typeof generation !== 'object' ||
          !['chat', 'insight', 'screenInsight'].includes(generation.mode) ||
          typeof generation.requestId !== 'string' ||
          !generation.requestId.trim() ||
          generation.requestId.length > 100 ||
          kind === 'transcript' ||
          (kind === 'user' && generation.mode !== 'chat'))
      )
        throw new Error('Invalid generation identity.');
      if (segmentId) {
        const existing = segment(sessionId, segmentId);
        if (existing) return existing;
      }
      const entry = {
        id: randomUUID(),
        session_id: sessionId,
        kind,
        speaker,
        content: text(content, 100000),
        created_at: new Date().toISOString(),
        segment_id: segmentId,
        generation_mode: generation?.mode ?? null,
        request_id: generation?.requestId ?? null,
      };
      db.prepare(
        'INSERT INTO entries(id,session_id,kind,speaker,content,created_at,segment_id,generation_mode,request_id) VALUES (?,?,?,?,?,?,?,?,?)',
      ).run(
        entry.id,
        entry.session_id,
        kind,
        speaker,
        entry.content,
        entry.created_at,
        segmentId,
        entry.generation_mode,
        entry.request_id,
      );
      return entry;
    },
  };
}
module.exports = { entryRepository };
