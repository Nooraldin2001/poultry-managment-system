// Resolves mock data as a Promise so service call-sites already look async,
// making the future swap to real HTTP calls a drop-in change.
export function mockDelay<T>(data: T, ms = 0): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}
