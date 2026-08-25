/** Centralized ICE configuration for all renderer-created peer connections. */

export interface IceEnvironment {
  readonly VITE_STUN_URLS?: string;
  readonly VITE_TURN_URLS?: string;
  readonly VITE_TURN_USERNAME?: string;
  readonly VITE_TURN_CREDENTIAL?: string;
}

function splitUrls(value: string | undefined): string[] {
  return value?.split(',').map((url) => url.trim()).filter(Boolean) ?? [];
}

/**
 * Builds one immutable RTC configuration for the application lifetime.
 * TURN is included only when all required credentials are present.
 */
export function createRtcConfiguration(environment: IceEnvironment = {}): RTCConfiguration {
  const stunUrls = splitUrls(environment.VITE_STUN_URLS);
  const iceServers: RTCIceServer[] = [
    {
      urls: stunUrls.length > 0 ? stunUrls : ['stun:stun.l.google.com:19302'],
    },
  ];

  const turnUrls = splitUrls(environment.VITE_TURN_URLS);
  const turnUsername = environment.VITE_TURN_USERNAME?.trim();
  const turnCredential = environment.VITE_TURN_CREDENTIAL?.trim();
  if (turnUrls.length > 0 && turnUsername && turnCredential) {
    iceServers.push({ urls: turnUrls, username: turnUsername, credential: turnCredential });
  }

  return { iceServers };
}
