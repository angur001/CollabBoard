# CollabBoard

A web app that lets teams draw together in real time. Pick a room name, share it, and everyone in that room sees the same canvas and each other’s strokes as they draw.


## Features:

Collaborative drawing — Brush, line, rectangle, eraser, and text tools, with live sync via WebSockets (Socket.io).

Room-based sessions — Join or create rooms by name; only people in the same room see the same board.

Smooth UX — Pan and zoom, undo/redo, clear canvas, and a dark theme so it’s easy on the eyes.

Presence — See who’s drawing and where, with labels for active users.

Built with React and Node.js to explore real-time collaboration and canvas rendering. Great for remote brainstorming, quick sketches, or teaching how real-time sync works.

## Commands
- **Frontend dev**: `cd CollabBoard && npm run dev` (Vite on default port)
- **Frontend build**: `cd CollabBoard && npm run build`
- **Frontend lint**: `cd CollabBoard && npm run lint` (ESLint)
- **Server start**: `cd server && npm start` (Node, port 3001)
- No test framework is configured.
