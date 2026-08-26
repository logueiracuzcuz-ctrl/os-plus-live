/**
 * Room management for the signaling server.
 * Handles creation, lookup, and lifecycle of screen sharing rooms.
 */

import type { WebSocket } from 'ws';
import { ROOM_CONFIG } from '@screenshare/shared';
import type { ParticipantInfo, RoomInfo } from '@screenshare/shared';
import { RoomState } from '@screenshare/shared';
import { v4 as uuidv4 } from 'uuid';

/**
 * Represents a connected client in a room.
 */
export interface ClientConnection {
  id: string;
  displayName: string;
  ws: WebSocket;
  isHost: boolean;
  joinedAt: number;
}

/**
 * Represents a screen sharing room.
 */
export class Room {
  readonly id: string;
  readonly code: string;
  readonly createdAt: number;
  host: ClientConnection;
  /** Keeps the original host identity so the room code remains reusable. */
  hostConnected: boolean;
  viewers: Map<string, ClientConnection>;
  private readonly sharingParticipantIds = new Set<string>();
  state: RoomState;
  lastActivityAt: number;

  constructor(host: ClientConnection, code: string) {
    this.id = uuidv4();
    this.code = code;
    this.host = host;
    this.hostConnected = true;
    this.viewers = new Map();
    this.state = RoomState.WAITING;
    this.createdAt = Date.now();
    this.lastActivityAt = Date.now();
  }

  /** Adds a viewer to the room. Returns false if the room is full. */
  addViewer(client: ClientConnection): boolean {
    if (this.viewers.size >= ROOM_CONFIG.MAX_PARTICIPANTS) {
      return false;
    }
    this.viewers.set(client.id, client);
    this.lastActivityAt = Date.now();
    return true;
  }

  /** Removes a client (host or viewer) from the room. */
  removeClient(clientId: string): void {
    if (this.host.id === clientId) {
      this.hostConnected = false;
      this.state = RoomState.WAITING;
    } else {
      this.viewers.delete(clientId);
    }
    this.sharingParticipantIds.delete(clientId);
    this.lastActivityAt = Date.now();
  }

  /** Checks if the room is empty (no host and no viewers). */
  isEmpty(): boolean {
    return !this.hostConnected && this.viewers.size === 0;
  }

  /** Returns the total participant count (host + viewers). */
  get participantCount(): number {
    return (this.hostConnected ? 1 : 0) + this.viewers.size;
  }

  /** Returns room information snapshot. */
  toInfo(): RoomInfo {
    return {
      id: this.id,
      code: this.code,
      state: this.state,
      hostId: this.host.id,
      hostDisplayName: this.host.displayName,
      viewerIds: Array.from(this.viewers.keys()),
      createdAt: this.createdAt,
      lastActivityAt: this.lastActivityAt,
    };
  }

  /** Returns currently connected participants, excluding a departed host. */
  getActiveClients(): ClientConnection[] {
    return [
      ...(this.hostConnected ? [this.host] : []),
      ...Array.from(this.viewers.values()),
    ];
  }

  /** Updates whether an active participant is currently sharing. */
  setParticipantSharing(clientId: string, isSharing: boolean): boolean {
    const participant = this.host.id === clientId
      ? (this.hostConnected ? this.host : undefined)
      : this.viewers.get(clientId);
    if (!participant) return false;

    if (isSharing) {
      this.sharingParticipantIds.add(clientId);
    } else {
      this.sharingParticipantIds.delete(clientId);
    }
    this.state = this.sharingParticipantIds.size > 0 ? RoomState.SHARING : RoomState.WAITING;
    this.lastActivityAt = Date.now();
    return true;
  }

  /** Returns participant info list for all active participants. */
  getParticipants(): ParticipantInfo[] {
    const participants: ParticipantInfo[] = [];
    if (this.hostConnected) {
      participants.push({
        id: this.host.id,
        displayName: this.host.displayName,
        isHost: true,
        isSharing: this.sharingParticipantIds.has(this.host.id),
        joinedAt: this.host.joinedAt,
      });
    }

    for (const viewer of this.viewers.values()) {
      participants.push({
        id: viewer.id,
        displayName: viewer.displayName,
        isHost: false,
        isSharing: this.sharingParticipantIds.has(viewer.id),
        joinedAt: viewer.joinedAt,
      });
    }

    return participants;
  }
}

/**
 * Manages all active rooms on the server.
 */
export class RoomManager {
  private roomsByCode: Map<string, Room>;
  private roomsById: Map<string, Room>;
  private clientRoomMap: Map<string, Room>;

  constructor() {
    this.roomsByCode = new Map();
    this.roomsById = new Map();
    this.clientRoomMap = new Map();
  }

  /** Creates a new room with the given host and room code. */
  createRoom(host: ClientConnection, code: string): Room {
    const room = new Room(host, code);
    this.roomsByCode.set(code, room);
    this.roomsById.set(room.id, room);
    this.clientRoomMap.set(host.id, room);
    return room;
  }

  /** Finds a room by its code. */
  getRoomByCode(code: string): Room | undefined {
    return this.roomsByCode.get(code);
  }

  /** Finds a room by its internal ID. */
  getRoomById(id: string): Room | undefined {
    return this.roomsById.get(id);
  }

  /** Gets the room that a specific client is in. */
  getClientRoom(clientId: string): Room | undefined {
    return this.clientRoomMap.get(clientId);
  }

  /** Associates a client with a room. */
  addClientToRoom(clientId: string, room: Room): void {
    this.clientRoomMap.set(clientId, room);
  }

  /** Removes a room and all its associations. */
  removeRoom(roomCode: string): void {
    const room = this.roomsByCode.get(roomCode);
    if (!room) return;

    this.roomsByCode.delete(roomCode);
    this.roomsById.delete(room.id);
    this.clientRoomMap.delete(room.host.id);
    for (const viewerId of room.viewers.keys()) {
      this.clientRoomMap.delete(viewerId);
    }
  }

  /** Removes a client from their room and cleans up if the room becomes empty. */
  removeClient(clientId: string): Room | undefined {
    const room = this.clientRoomMap.get(clientId);
    if (!room) return undefined;

    room.removeClient(clientId);
    this.clientRoomMap.delete(clientId);

    // A room remains reusable through JOIN_ROOM after its host disconnects.

    return room;
  }

  /** Generates a unique room code that doesn't collide with existing rooms. */
  generateUniqueCode(): string {
    const chars = ROOM_CONFIG.ROOM_CODE_CHARS;
    const length = ROOM_CONFIG.ROOM_CODE_LENGTH;
    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
      let code = '';
      for (let i = 0; i < length; i++) {
        const index = Math.floor(Math.random() * chars.length);
        code += chars.charAt(index);
      }

      if (!this.roomsByCode.has(code)) {
        return code;
      }
      attempts++;
    }

    throw new Error('Failed to generate unique room code after maximum attempts');
  }

  /** Returns the number of active rooms. */
  get activeRoomCount(): number {
    return this.roomsByCode.size;
  }

  /** Returns the total number of connected clients. */
  get totalClientCount(): number {
    return this.clientRoomMap.size;
  }
}
