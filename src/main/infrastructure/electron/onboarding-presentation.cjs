// Where onboarding shows. While it runs, the bar and the Notch step aside; the panel either hands it to a visible
// workspace or, on a first launch, grows to hold it. When onboarding ends the panel returns to its earlier bounds.
function createOnboardingPresentation({ privacy, open, notch, windows, resizePanel, changed }) {
  let active = false,
    panelBounds = null;
  return {
    active: () => active,
    present(caller, next) {
      const { main, overlay, bar } = windows();
      if (next && !active && open(overlay)) panelBounds = overlay.getBounds();
      active = next;
      if (next) {
        if (open(bar)) privacy().hide(bar);
        if (open(notch())) privacy().hide(notch());
        if (open(overlay)) {
          // The workspace also asks while it starts hidden behind the floating bar; only a workspace the person can see
          // takes the onboarding from the panel.
          if (caller === main) {
            if (main.isVisible()) privacy().hide(overlay);
          } else {
            // On a first launch the panel exists but has never been shown, and the bar just went away: show it, or
            // nothing of the app is on screen.
            resizePanel(640, 680);
            privacy().show(overlay, false);
          }
        }
      } else if (panelBounds && open(overlay)) {
        overlay.setBounds(panelBounds);
        panelBounds = null;
      }
      changed();
    },
  };
}

module.exports = { createOnboardingPresentation };
