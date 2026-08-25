import { createRtcConfiguration } from '../src/renderer/services/webrtc/iceConfig';

describe('createRtcConfiguration', () => {
  it('uses the development STUN server when none is configured', () => {
    const configuration = createRtcConfiguration({});

    expect(configuration.iceServers).toEqual([
      { urls: ['stun:stun.l.google.com:19302'] },
    ]);
  });

  it('adds TURN only when URLs and credentials are complete', () => {
    const configuration = createRtcConfiguration({
      VITE_STUN_URLS: 'stun:example.test:3478',
      VITE_TURN_URLS: 'turn:turn.example.test:3478, turns:turn.example.test:5349',
      VITE_TURN_USERNAME: 'user',
      VITE_TURN_CREDENTIAL: 'credential',
    });

    expect(configuration.iceServers).toEqual([
      { urls: ['stun:example.test:3478'] },
      {
        urls: ['turn:turn.example.test:3478', 'turns:turn.example.test:5349'],
        username: 'user',
        credential: 'credential',
      },
    ]);
  });

  it('ignores incomplete TURN configuration', () => {
    const configuration = createRtcConfiguration({
      VITE_TURN_URLS: 'turn:turn.example.test:3478',
      VITE_TURN_USERNAME: 'user',
    });

    expect(configuration.iceServers).toHaveLength(1);
  });
});
