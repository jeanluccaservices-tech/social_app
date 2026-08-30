// Best-effort deterrents against saving photos from the app: blocks the
// right-click "Save image as" menu, native drag-out-to-save, and the
// long-press "Save Photo" callout on iOS/Android browsers. This can't stop
// devtools, browser extensions, or a plain screenshot — nothing running in
// the page can — so it's paired with an explicit Terms of Use prohibition
// rather than presented as real protection.
export const noDownloadImageProps = {
  onContextMenu: (e) => e.preventDefault(),
  onDragStart: (e) => e.preventDefault(),
  draggable: false,
  style: {
    WebkitUserSelect: 'none',
    userSelect: 'none',
    WebkitTouchCallout: 'none'
  }
};
