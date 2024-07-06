let timerId;
let seconds = 0;
let interval;

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



self.onmessage = function(e) {
    if (e.data.command === 'start') {
        interval = setInterval(() => {
            self.postMessage({ type: 'tick' });
        }, 1000);
    } else if (e.data.command === 'stop') {
        clearInterval(interval);
        self.postMessage({ type: 'stopped' });
    }
};
