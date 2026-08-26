/**
 * Signaling message types used in the WebRTC signaling protocol.
 * These define the contract between client and server for peer connection negotiation.
 */
export enum SignalingMessageType {
  /** Server confirms connection and assigns client ID */
  CONNECTED = 'CONNECTED',
  /** Client requests to create a new room */
  CREATE_ROOM = 'CREATE_ROOM',
  /** Server responds with the created room info */
  ROOM_CREATED = 'ROOM_CREATED',
  /** Client requests to join an existing room */
  JOIN_ROOM = 'JOIN_ROOM',
  /** Server confirms room join */
  ROOM_JOINED = 'ROOM_JOINED',
  /** Server notifies that a participant joined */
  PARTICIPANT_JOINED = 'PARTICIPANT_JOINED',
  /** Client requests to leave the room */
  LEAVE_ROOM = 'LEAVE_ROOM',
  /** Server notifies that a participant left */
  PARTICIPANT_LEFT = 'PARTICIPANT_LEFT',
  /** Participant starts or stops sharing a local screen. */
  PARTICIPANT_SHARING_CHANGED = 'PARTICIPANT_SHARING_CHANGED',
  /** WebRTC SDP offer */
  WEBRTC_OFFER = 'WEBRTC_OFFER',
  /** WebRTC SDP answer */
  WEBRTC_ANSWER = 'WEBRTC_ANSWER',
  /** ICE candidate exchange */
  ICE_CANDIDATE = 'ICE_CANDIDATE',
  /** Legacy WebRTC SDP offer name kept for protocol compatibility. */
  OFFER = 'OFFER',
  /** Legacy WebRTC SDP answer name kept for protocol compatibility. */
  ANSWER = 'ANSWER',
  /** Server sends updated room information */
  ROOM_INFO = 'ROOM_INFO',
  /** Server reports an error */
  ERROR = 'ERROR',
}

/**
 * Base signaling message with type discriminator.
 */
export interface SignalingMessage {
  type: SignalingMessageType;
}

/**
 * Payload for CONNECTED message (server sends on connection).
 */
export interface ConnectedMessage extends SignalingMessage {
  type: SignalingMessageType.CONNECTED;
  payload: {
    clientId: string;
  };
}

/**
 * Payload for CREATE_ROOM message.
 */
export interface CreateRoomMessage extends SignalingMessage {
  type: SignalingMessageType.CREATE_ROOM;
  payload: {
    displayName: string;
  };
}

/**
 * Payload for ROOM_CREATED response.
 */
export interface RoomCreatedMessage extends SignalingMessage {
  type: SignalingMessageType.ROOM_CREATED;
  payload: {
    roomCode: string;
    participantId: string;
  };
}

/**
 * Payload for JOIN_ROOM message.
 */
export interface JoinRoomMessage extends SignalingMessage {
  type: SignalingMessageType.JOIN_ROOM;
  payload: {
    roomCode: string;
    displayName: string;
  };
}

/**
 * Payload for ROOM_JOINED response.
 */
export interface RoomJoinedMessage extends SignalingMessage {
  type: SignalingMessageType.ROOM_JOINED;
  payload: {
    roomCode: string;
    participantId: string;
    hostId: string;
    hostDisplayName: string;
    participants: ParticipantInfo[];
  };
}

/**
 * Payload for PARTICIPANT_JOINED notification.
 */
export interface ParticipantJoinedMessage extends SignalingMessage {
  type: SignalingMessageType.PARTICIPANT_JOINED;
  payload: {
    participant: ParticipantInfo;
  };
}

/**
 * Payload for LEAVE_ROOM message.
 */
export interface LeaveRoomMessage extends SignalingMessage {
  type: SignalingMessageType.LEAVE_ROOM;
  payload: {
    roomCode: string;
    participantId: string;
  };
}

/**
 * Payload for PARTICIPANT_LEFT notification.
 */
export interface ParticipantLeftMessage extends SignalingMessage {
  type: SignalingMessageType.PARTICIPANT_LEFT;
  payload: {
    participantId: string;
    displayName: string;
  };
}

/** Payload for a participant sharing state change. */
export interface ParticipantSharingChangedMessage extends SignalingMessage {
  type: SignalingMessageType.PARTICIPANT_SHARING_CHANGED;
  payload: {
    roomCode: string;
    participantId: string;
    isSharing: boolean;
  };
}

/** Common routing information for WebRTC signaling messages. */
export interface WebRtcSignalRouting {
  roomCode: string;
  participantId: string;
  targetId: string;
}

/** Payload for a WebRTC SDP offer. */
export interface WebRtcOfferMessage extends SignalingMessage {
  type: SignalingMessageType.WEBRTC_OFFER;
  payload: WebRtcSignalRouting & {
    sdp: RTCSessionDescriptionInit;
  };
}

/** Payload for a WebRTC SDP answer. */
export interface WebRtcAnswerMessage extends SignalingMessage {
  type: SignalingMessageType.WEBRTC_ANSWER;
  payload: WebRtcSignalRouting & {
    sdp: RTCSessionDescriptionInit;
  };
}

/** Payload for an ICE candidate exchange. */
export interface IceCandidateMessage extends SignalingMessage {
  type: SignalingMessageType.ICE_CANDIDATE;
  payload: WebRtcSignalRouting & {
    candidate: RTCIceCandidateInit;
  };
}

/** Legacy offer shape retained for consumers of the old protocol names. */
export interface OfferMessage extends SignalingMessage {
  type: SignalingMessageType.OFFER;
  payload: WebRtcSignalRouting & { sdp: RTCSessionDescriptionInit };
}

/** Legacy answer shape retained for consumers of the old protocol names. */
export interface AnswerMessage extends SignalingMessage {
  type: SignalingMessageType.ANSWER;
  payload: WebRtcSignalRouting & { sdp: RTCSessionDescriptionInit };
}

/**
 * Payload for ROOM_INFO updates.
 */
export interface RoomInfoMessage extends SignalingMessage {
  type: SignalingMessageType.ROOM_INFO;
  payload: {
    participants: ParticipantInfo[];
    viewerCount: number;
  };
}

/**
 * Payload for ERROR messages.
 */
export interface ErrorMessage extends SignalingMessage {
  type: SignalingMessageType.ERROR;
  payload: {
    code: string;
    message: string;
  };
}

/**
 * Information about a single participant in a room.
 */
export interface ParticipantInfo {
  id: string;
  displayName: string;
  isHost: boolean;
  isSharing: boolean;
  joinedAt: number;
}

/**
 * Union type of all possible signaling messages.
 */
export type AnySignalingMessage =
  | ConnectedMessage
  | CreateRoomMessage
  | RoomCreatedMessage
  | JoinRoomMessage
  | RoomJoinedMessage
  | ParticipantJoinedMessage
  | LeaveRoomMessage
  | ParticipantLeftMessage
  | ParticipantSharingChangedMessage
  | WebRtcOfferMessage
  | WebRtcAnswerMessage
  | IceCandidateMessage
  | OfferMessage
  | AnswerMessage
  | RoomInfoMessage
  | ErrorMessage;
