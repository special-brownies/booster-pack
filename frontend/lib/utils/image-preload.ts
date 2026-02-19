type PreloadOptions = {
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 7000;

function preloadImage(url: string): Promise<void> {
  return new Promise((resolve) => {
    const image = new Image();
    const finish = () => {
      image.onload = null;
      image.onerror = null;
      resolve();
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
    if (image.complete) finish();
  });
}

export async function preloadImages(urls: string[], options: PreloadOptions = {}): Promise<void> {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));
  if (!uniqueUrls.length || typeof window === "undefined") return;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const preloadPromise = Promise.all(uniqueUrls.map((url) => preloadImage(url)));
  const timeoutPromise = new Promise<void>((resolve) => {
    window.setTimeout(resolve, timeoutMs);
  });
  await Promise.race([preloadPromise, timeoutPromise]);
}
