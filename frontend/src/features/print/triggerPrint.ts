/**
 * Opens the browser print dialog after the A4 layout has painted.
 * Double rAF helps mobile Safari render mm-based width before print preview.
 */
export function triggerPrint(): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.print();
    });
  });
}
