// The recording bar's session rows: a directed prompt and a live transcript preview appear above the bar
// controls only while every session surface is hidden or minimized. Locally the only session surface is the session
// panel; the optional Notch and the workspace window are not session surfaces.
//
// The prompt does not depend on the Notch being available: answers are saved in Session (and also shown in the
// Notch when it is on).
const ROW_HEIGHTS = Object.freeze({ preview: 36, prompt: 44, guide: 48 });

function barRows({ hasActiveSession, sessionSurfaceVisible, capturing, guiding = false }) {
  const surfacesHidden = !sessionSurfaceVisible;
  return {
    prompt: Boolean(hasActiveSession && surfacesHidden),
    preview: Boolean(capturing && surfacesHidden),
    // The first-session tip waits above the controls until listening starts; listening opens the panel, which
    // coaches the rest of that session.
    guide: Boolean(guiding && surfacesHidden && !capturing),
  };
}

// The extra height the bar window needs above its controls for the rows that are shown.
function barRowsHeight(rows) {
  return (
    (rows.preview ? ROW_HEIGHTS.preview : 0) +
    (rows.prompt ? ROW_HEIGHTS.prompt : 0) +
    (rows.guide ? ROW_HEIGHTS.guide : 0)
  );
}

module.exports = { ROW_HEIGHTS, barRows, barRowsHeight };
