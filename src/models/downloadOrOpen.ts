export function downloadOrOpen(url: string, filename: string): void {
  if (typeof chrome !== "undefined" && chrome.downloads) {
    chrome.downloads.download({ url, filename });
  } else {
    window.open(url);
  }
}
