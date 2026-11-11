# Overview conflict and save recovery

Manual overview saves now carry the exact summary value last read by that editor. SQLite applies each save only while the stored value still matches. A second window can therefore save first without being silently overwritten by an older draft. The stale editor keeps its draft, pauses autosave and offers two explicit actions: load the newest stored value or replace it after fetching that value. The replacement still uses the same atomic comparison, so another concurrent write can trigger another conflict.

Temporary save failures keep the draft and expose Retry save. A previous success timer cannot clear a later error state. Done keeps the editor open on failure; Discard loads the latest saved overview and does not roll back earlier successful autosaves. AI rewrites remain drafts until Done.

Verification: backend tests passed 135/135; UI tests passed 29/29; TypeScript/Vite build and JavaScript syntax check passed. Isolated Electron smoke passed 168/168 with zero renderer console errors. It exercised two native windows, conflict preservation, both recovery actions, a forced temporary failure, retry, and unchanged transcript data. The provider response was a controlled local fixture. A real-provider rewrite and long-session behavior remain unverified. The visuals were reviewed on a local board.
