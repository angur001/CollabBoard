import { io } from 'socket.io-client'

class SocketManager {
  socket = null

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
  emitDrawingStart(id, type, color, size) {
    if (this.socket) {
      this.socket.emit('drawing-start', { id, type, color, size })
    }
  }

  // Emit when user adds a point to current stroke
  emitDrawingPoint(id, point) {
    if (this.socket) {
      this.socket.emit('drawing-point', { id, point })
    }
  }

  // Emit when user finishes a stroke
  emitDrawingEnd(id) {
    if (this.socket) {
      this.socket.emit('drawing-end', { id })
    }
  }

  // Emit when user clears canvas
  emitClearCanvas() {
    if (this.socket) {
      this.socket.emit('clear-canvas')
    }
  }

  // Emit when user undoes a drawing
  emitUndo(id) {
    if (this.socket) {
      this.socket.emit('undo', { id })
    }
  }

  // Emit when user redoes a drawing
  emitRedo(id, type, color, size, points) {
    if (this.socket) {
      this.socket.emit('redo', { id, type, color, size, points })
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

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
  }
}

export default new SocketManager()

