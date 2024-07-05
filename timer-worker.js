let timerId;
let seconds = 0;

self.onmessage = function(e) {
  if (e.data.command === 'start') {
    seconds = 0;
    timerId = setInterval(() => {
      seconds++;
      self.postMessage({ type: 'tick', seconds: seconds });
    }, 1000);
  } else if (e.data.command === 'stop') {
    clearInterval(timerId);
    self.postMessage({ type: 'stopped', seconds: seconds });
  }
};
