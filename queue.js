// queue.js
const q = [];
let running = false;

export function enqueue(fn) {
  return new Promise((resolve, reject) => {
    q.push({ fn, resolve, reject });
    run();
  });
}

async function run() {
  if (running) return;
  running = true;
  while (q.length) {
    const job = q.shift();
    try {
      const out = await job.fn();
      job.resolve(out);
    } catch (e) {
      job.reject(e);
    }
  }
  running = false;
}
