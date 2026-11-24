# The transcript stays on Virtuoso

The transcript's virtual list stays on `react-virtuoso`. A spike measured `virtua` as the alternative, because the transcript perf tests (`transcript-view.perf.test.tsx`) measured scrolling at 37.1 fps on CI, under the 45 fps line set in #147. virtua was slower on both tests, and kept the scroll behaviours below only through code of our own.

| On the CI runner, production React with the React Compiler | Virtuoso 4.18 | virtua 0.55 |
|---|---|---|
| Scrolling 2,000 items from top to bottom | 37.1 fps | 28.9 fps |
| Streaming a 10,000-token answer | 55.8 fps | 44.6 fps |
| Added to the UI bundle, minified / gzipped | already there | +8.2 KB / +3.6 KB |

Locally, with Chromium's CPU slowed 8×, which brings both rates close to CI's, scrolling measured 36.0 fps on Virtuoso and 26.0 fps on virtua over two runs each. virtua renders synchronously on each scroll event (`flushSync`), so a frame that brings new rows into view does all their work before it paints. Virtuoso spreads that work over more frames.

A CPU profile of the scrolling frames puts Virtuoso's own code at about 3% of the script time. The rest is parsing Markdown and laying out rows as they come into view. The next gain in scrolling is in mounting a row, not in the list.

Scroll behaviours, as the existing transcript tests check them:

- **A session opens on its last item.** Virtuoso: `initialTopMostItemIndex`. virtua: our own scroll to the end after each render while at the bottom.
- **The view follows new output only while it is at the bottom.** Virtuoso: `followOutput`. virtua: our own, with the bottom measured from the DOM because the footer after the list is outside virtua's sizes.
- **Loading older items above keeps the reading position.** Virtuoso: `firstItemIndex` and `startReached`. virtua: `shift`, plus a check near the top on every scroll and resize, since a list shorter than the view never scrolls.
- **The transcript follows its end until a sent message reaches the top of the view.** Unchanged: `useFollowSentMessage` works on the scroller element with either list.
- **Folding or unfolding a turn never moves the view.** Virtuoso: as is. virtua moves the view when a row that starts above it changes size. The spike puts the view back after a resize that follows a click in the transcript.

## Considered options

- **virtua 0.55**: rejected for the rates and the hand-written behaviours above. The spike's code is on the `spike/147-virtua` branch (draft pull request #150).
- **TanStack Virtual**: not measured. #147 had already rejected it: following output and keeping the position when older items load would be ours to write, as they were with virtua.
