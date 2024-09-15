const requestQueue: Array<() => Promise<void>> = [];

export function queueRequest(request: () => Promise<void>) {
  requestQueue.push(request);
}

export async function processQueue() {
  while (requestQueue.length > 0) {
    const request = requestQueue.shift();
    if (request) {
      try {
        await request();
      } catch (error) {
        console.error("Failed to process request:", error);
      }
    }
  }
}

// Call this function when the app comes back online
window.addEventListener("online", processQueue);
