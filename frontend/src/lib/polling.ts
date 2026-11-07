// Runs `poll` on the next tick, then every `ms` while the page is visible: a
// background tab, or an installed app in the background, doesn't poll. When
// the page is shown again it polls once right away. Returns a stop function
// for the effect's cleanup.
export function startPolling(
  poll: () => void,
  ms: number,
  { immediate = true } = {},
) {
  const first = immediate ? window.setTimeout(poll, 0) : undefined;
  const id = window.setInterval(() => {
    if (document.visibilityState === "visible") poll();
  }, ms);
  const onVisibilityChange = () => {
    if (document.visibilityState === "visible") poll();
  };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    window.clearTimeout(first);
    window.clearInterval(id);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
