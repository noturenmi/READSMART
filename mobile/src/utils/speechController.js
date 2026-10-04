const { splitSpeechText } = require('./textToSpeech');

const unavailableMessage = 'Text-to-Speech is currently unavailable on this device.';

function createSpeechController(speech, { supportsPause, onState = () => {}, onError = () => {} } = {}) {
  let state = 'idle';
  let session = 0;
  let remaining = 0;

  function setState(next) {
    state = next;
    onState(next);
  }

  function fail(currentSession, message = unavailableMessage) {
    if (session !== currentSession) return;
    session += 1;
    remaining = 0;
    setState('idle');
    onError(message);
    Promise.resolve(speech.stop()).catch(() => {});
  }

  async function speechOptions() {
    const options = { rate: 0.9 };
    try {
      const voices = await speech.getAvailableVoicesAsync();
      const englishVoice = voices.find((voice) => /^en(?:[-_]|$)/iu.test(voice.language || ''));
      if (englishVoice?.identifier) options.voice = englishVoice.identifier;
    } catch {
      // Voice enumeration may be unavailable; omit the voice and let the device choose its default.
    }
    return options;
  }

  return {
    getState() { return state; },
    async play(text) {
      if (state !== 'idle') return false;
      const chunks = splitSpeechText(text);
      if (!chunks.length) {
        onError('There is no lesson text available to read.');
        return false;
      }

      const currentSession = ++session;
      remaining = chunks.length;
      setState('starting');
      try {
        await speech.stop();
        const options = await speechOptions();
        if (session !== currentSession) return false;
        for (const chunk of chunks) {
          if (session !== currentSession) return false;
          speech.speak(chunk, {
            ...options,
            onStart() {
              if (session === currentSession && state === 'starting') setState('speaking');
            },
            onDone() {
              if (session !== currentSession) return;
              remaining -= 1;
              if (remaining <= 0) setState('idle');
            },
            onStopped() {
              if (session === currentSession) setState('idle');
            },
            onError() { fail(currentSession); },
          });
        }
        return session === currentSession;
      } catch {
        fail(currentSession);
        return false;
      }
    },
    async pause() {
      if (!supportsPause || state !== 'speaking') return false;
      const currentSession = session;
      try {
        await speech.pause();
        if (session !== currentSession) return false;
        setState('paused');
        return true;
      } catch {
        onError('Pause is currently unavailable on this device.');
        return false;
      }
    },
    async resume() {
      if (!supportsPause || state !== 'paused') return false;
      const currentSession = session;
      try {
        await speech.resume();
        if (session !== currentSession) return false;
        setState('speaking');
        return true;
      } catch {
        onError('Resume is currently unavailable on this device.');
        return false;
      }
    },
    async stop({ silent = false } = {}) {
      session += 1;
      remaining = 0;
      setState('idle');
      try {
        await speech.stop();
        return true;
      } catch {
        if (!silent) onError(unavailableMessage);
        return false;
      }
    },
  };
}

module.exports = { createSpeechController, unavailableMessage };
