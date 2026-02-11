import { io } from 'socket.io-client'

class SocketManager {
  socket = null
  roomId = null

  connect(serverUrl = 'http://localhost:3001') {
    if (this.socket) return this.socket

    this.socket = io(serverUrl)

    this.socket.on('connect', () => {
      console.log('Connected to server:', this.socket.id)
      if (this.onConnectCallback) this.onConnectCallback()
    })

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server')
      if (this.onDisconnectCallback) this.onDisconnectCallback()
    })

    return this.socket
  }

  setRoomId(roomId) {
    this.roomId = roomId
  }

  emitJoinRoom(roomId) {
    if (this.socket) {
      this.socket.emit('join-room', { roomId })
    }
  }

  emitLeaveRoom(roomId) {
    if (this.socket) {
      this.socket.emit('leave-room', { roomId })
    }
  }

  onConnect(callback) {
    this.onConnectCallback = callback
    // If already connected, call immediately
    if (this.socket?.connected) {
      callback()
    }
  }

  onDisconnect(callback) {
    this.onDisconnectCallback = callback
  }

  isConnected() {
    return this.socket?.connected ?? false
  }

  // Emit when user starts a new stroke
  emitDrawingStart(id, type, color, size, roomId) {
    if (this.socket) {
      this.socket.emit('drawing-start', { id, type, color, size, roomId })
    }
  }

  // Emit when user adds a point to current stroke
  emitDrawingPoint(id, point, roomId) {
    if (this.socket) {
      this.socket.emit('drawing-point', { id, point, roomId })
    }
  }

  // Emit when user finishes a stroke
  emitDrawingEnd(id, roomId) {
    if (this.socket) {
      this.socket.emit('drawing-end', { id, roomId })
    }
  }

  // Emit when user clears canvas
  emitClearCanvas(roomId) {
    if (this.socket) {
      this.socket.emit('clear-canvas', { roomId })
    }
  }

  // Emit when user undoes a drawing
  emitUndo(id, roomId) {
    if (this.socket) {
      this.socket.emit('undo', { id, roomId })
    }
  }

  // Emit when user redoes a drawing
  emitRedo(id, type, color, size, points, roomId) {
    if (this.socket) {
      this.socket.emit('redo', { id, type, color, size, points, roomId })
    }
  }

  emitText(id, text, x, y, color, size, roomId) {
    if (this.socket) {
      this.socket.emit('text', { id, text, x, y, color, size, roomId })
    }
  }

  // Listen for drawing events from other users
  onDrawingStart(callback) {
    if (this.socket) {
      this.socket.on('drawing-start', callback)
    }
  }

  onDrawingPoint(callback) {
    if (this.socket) {
      this.socket.on('drawing-point', callback)
    }
  }

  onDrawingEnd(callback) {
    if (this.socket) {
      this.socket.on('drawing-end', callback)
    }
  }

  onClearCanvas(callback) {
    if (this.socket) {
      this.socket.on('clear-canvas', callback)
    }
  }

  onUndo(callback) {
    if (this.socket) {
      this.socket.on('undo', callback)
    }
  }

  onRedo(callback) {
    if (this.socket) {
      this.socket.on('redo', callback)
    }
  }

  // Sync existing drawings when connecting
  onSyncDrawings(callback) {
    if (this.socket) {
      this.socket.on('sync-drawings', callback)
    }
  }

  onText(callback) {
    if (this.socket) {
      this.socket.on('text', callback)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
  
}

export default new SocketManager()

