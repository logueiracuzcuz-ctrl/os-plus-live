# ScreenShare - Phase 1

## What was implemented

### Project Structure

- Monorepo with npm workspaces: `shared`, `server`, `client`
- Separate `docs/` and `tests/` directories

### Shared Package (`@screenshare/shared`)

- **Signaling types**: Complete message type definitions for the WebRTC signaling protocol (CREATE_ROOM, JOIN_ROOM, OFFER, ANSWER, ICE_CANDIDATE, etc.)
- **Room types**: Room state, room info, and room configuration interfaces
- **Media types**: Screen capture config, peer connection config, default ICE servers
- **Constants**: Server config, room config, rate limit config, client config
- **Validation**: Display name, room code, signaling message, and message size validators

### Server Package (`@screenshare/server`)

- **RoomManager**: Room creation, lookup by code/id, client tracking, unique code generation, room cleanup
- **Room class**: Participant management (host + viewers), state tracking, capacity limits, participant info serialization
- **Server entry**: WebSocket server skeleton with graceful shutdown, environment variable configuration, logging, global error handling

### Client Package (`@screenshare/client`)

- **Electron main process**: Window creation with secure defaults (contextIsolation, sandbox, nodeIntegration disabled)
- **Preload script**: Safe contextBridge API exposure (getVersion, getPlatform)
- **React renderer**: Basic UI shell with status indicator and action buttons
- **Vite configuration**: Dev server on port 5173, production build output, resolve aliases for shared package
- **CSS**: Dark theme styling with CSS custom properties
- **esbuild**: Main and preload process bundling with dependency inlining
- **Packaging**: Custom script (`scripts/package.mjs`) for Windows .exe generation via @electron/packager

### Quality Tools

- **ESLint 9** (flat config): TypeScript recommended rules, React/Hooks plugins, Node.js globals for scripts
- **Prettier**: Consistent code formatting (single quotes, trailing commas, 100 char print width)
- **TypeScript strict mode**: All packages use strict with noUncheckedIndexedAccess, noImplicitOverride, noPropertyAccessFromIndexSignature
- **Type checking**: Separate tsconfig for renderer, main process, preload, and Vite config
- **Tests**: Jest + ts-jest with ESM support

### Tests

- Shared: 22 validation unit tests (display name, room code, signaling messages, message size)
- Server: 15 RoomManager and Room unit tests (CRUD, capacity, lifecycle, serialization)

## How to run

```bash
# Install dependencies
npm install

# Build all packages (shared first, then server and client)
npm run build

# Run all tests (37 total)
npm test

# Lint all source files
npm run lint

# Auto-fix lint issues
npm run lint:fix

# Format all source files
npm run format

# Check formatting without modifying files
npm run format:check

# TypeScript type checking across all packages
npm run typecheck

# Development - Server only
npm run dev:server

# Development - Client only (opens Electron with Vite dev server)
npm run dev:client

# Generate Windows .exe
npm run build --workspace=client
npm run package --workspace=client
```

## Technology Stack

- **Runtime**: Node.js 18+, Electron 31
- **Language**: TypeScript 5.5 (strict mode)
- **Frontend**: React 18, Vite 5
- **Server**: ws (WebSocket)
- **Testing**: Jest + ts-jest
- **Linting**: ESLint 9 (flat config), Prettier 3
- **Build**: npm workspaces (monorepo), esbuild, @electron/packager

## Next Phase (Phase 2)

- WebSocket message handling and routing
- Room creation and join flows
- Client-side signaling service
- Real-time communication between client and server
