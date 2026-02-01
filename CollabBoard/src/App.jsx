import { useRef, useState, useEffect, useCallback } from 'react'
import './index.css'
import DrawingManager from './drawingManager'
import socketManager from './socketManager'

const COLORS = [
  { name: 'Black', value: '#1a1a2e' },
  { name: 'Red', value: '#e63946' },
  { name: 'Orange', value: '#f77f00' },
  { name: 'Yellow', value: '#fcbf49' },
  { name: 'Green', value: '#2a9d8f' },
  { name: 'Blue', value: '#457b9d' },
  { name: 'Purple', value: '#9b5de5' },
  { name: 'Pink', value: '#f72585' },
]

function App() {
  const canvasRef = useRef(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentColor, setCurrentColor] = useState(COLORS[0].value)
  const [lineWidth, setLineWidth] = useState(3)
  const lastPointRef = useRef(null)
  const drawingManager = useRef(null)
  const currentDrawingRecordId = useRef(null)
  // Track last points for remote drawings
  const remoteLastPoints = useRef({})
  // Track active remote drawers with their name and position
  const [activeDrawers, setActiveDrawers] = useState({})
  // Track undo/redo availability for UI state
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  // Track connection status
  const [isConnected, setIsConnected] = useState(false)
  const [roomId, setRoomId] = useState(null)
  const [roomInput, setRoomInput] = useState('')
  // Zoom and pan state
  const [zoom, setZoom] = useState(1.0)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isPanning, setIsPanning] = useState(false)
  const [isSpacePressed, setIsSpacePressed] = useState(false)
  const panStartRef = useRef(null)

  if (drawingManager.current === null) {
    drawingManager.current = new DrawingManager()
  }

  // Redraw all strokes from the drawing manager
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const container = canvas.parentElement;
    const { width, height } = container.getBoundingClientRect();

    
    // Clear the canvas first
    ctx.clearRect(0, 0, width, height)
    
    // Apply transformations
    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)
    
    const records = drawingManager.current.getDrawingRecords()
    
    for (const id in records) {
      const stroke = records[id]
      const points = stroke.points
      
      if (points.length < 2) continue
      
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      for (let i = 1; i < points.length; i++) {
        ctx.beginPath()
        ctx.moveTo(points[i - 1].x, points[i - 1].y)
        ctx.lineTo(points[i].x, points[i].y)
        ctx.stroke()
      }
    }
    
    ctx.restore()
  }, [zoom, panX, panY])

  // Used for drawing remote changes in real time
  const drawLineSegment = useCallback((fromPoint, toPoint, color, size) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Apply transformations
    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)
    
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    ctx.moveTo(fromPoint.x, fromPoint.y)
    ctx.lineTo(toPoint.x, toPoint.y)
    ctx.stroke()
    
    ctx.restore()
  }, [zoom, panX, panY])

useEffect(() => {
  if (!roomId) return;

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    const container = canvas?.parentElement;
    if (!canvas || !container) return;

    const { width, height } = container.getBoundingClientRect();

    // Check if we actually need to resize to avoid flickering
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      
      // Re-apply context settings lost on resize
      const ctx = canvas.getContext('2d');
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Trigger a redraw manually here
      redrawCanvas();
    }
  };

  // Initial call
  resizeCanvas();

  window.addEventListener('resize', resizeCanvas);
  return () => window.removeEventListener('resize', resizeCanvas);
}, [roomId, redrawCanvas]);

  // Redraw canvas when zoom or pan changes
  useEffect(() => {
    if (roomId) {
      redrawCanvas()
    }
  }, [zoom, panX, panY, roomId, redrawCanvas])

  // Socket connection setup
  useEffect(() => {
    if (!roomId) return

    socketManager.connect()

    // set connect and disconnect callbacks
    socketManager.onConnect(() => {
      setIsConnected(true)
      socketManager.emitJoinRoom(roomId)
    })
    socketManager.onDisconnect(() => setIsConnected(false))

    return () => {
      if (roomId) {
        socketManager.disconnect()
        socketManager.emitLeaveRoom(roomId)
      }
    }
  }, [roomId])

  // Socket event handlers (depends on redrawCanvas and drawLineSegment)
  useEffect(() => {
    if (!roomId) return

    // Sync existing drawings when joining
    socketManager.onSyncDrawings((records) => {
      drawingManager.current.clearDrawingRecords()
      for (const id in records) {
        const record = records[id]
        drawingManager.current.CreateNewDrawingRecord(id, record.type, record.color, record.size)
        record.points.forEach(point => {
          drawingManager.current.AddPointToRecord(id, point)
        })
      }
      redrawCanvas()
    })

    // Handle remote user starting a drawing
    socketManager.onDrawingStart((data) => {
      const { id, type, color, size, userName } = data
      drawingManager.current.CreateNewDrawingRecord(id, type, color, size)
      remoteLastPoints.current[id] = null
      
      // Add to active drawers
      setActiveDrawers(prev => ({
        ...prev,
        [id]: { userName, position: null, color }
      }))
    })

    // Handle remote user drawing points
    socketManager.onDrawingPoint((data) => {
      const { id, point, userName } = data
      const record = drawingManager.current.getDrawingRecord(id)
      if (record) {
        drawingManager.current.AddPointToRecord(id, point)
        
        // Draw the line segment in real-time
        const lastPoint = remoteLastPoints.current[id]
        if (lastPoint) {
          drawLineSegment(lastPoint, point, record.color, record.size)
        }
        remoteLastPoints.current[id] = point
        
        // Update drawer position
        setActiveDrawers(prev => ({
          ...prev,
          [id]: { userName, position: point, color: record.color }
        }))
      }
    })

    // Handle remote user finishing drawing
    socketManager.onDrawingEnd((data) => {
      delete remoteLastPoints.current[data.id]
      
      // Remove from active drawers
      setActiveDrawers(prev => {
        const updated = { ...prev }
        delete updated[data.id]
        return updated
      })
    })

    // Handle remote user clearing canvas
    socketManager.onClearCanvas(() => {
      drawingManager.current.clearDrawingRecords()
      updateUndoRedoState()
      redrawCanvas()
    })

    // Handle remote user undoing a drawing
    socketManager.onUndo((data) => {
      if (!data.id) return;
      const { id } = data
      
      drawingManager.current.deleteDrawingRecord(id)
      redrawCanvas()
    })

    // Handle remote user redoing a drawing
    socketManager.onRedo((data) => {
      const { id, type, color, size, points } = data
      drawingManager.current.createDrawingRecordWithPoints(id, type, color, size, points)
      redrawCanvas()
    })
  }, [redrawCanvas, drawLineSegment, roomId])

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    let screenX, screenY
    if (e.touches) {
      screenX = e.touches[0].clientX - rect.left
      screenY = e.touches[0].clientY - rect.top
    } else {
      screenX = e.clientX - rect.left
      screenY = e.clientY - rect.top
    }
    
    // Transform screen coordinates to canvas coordinates
    const canvasX = (screenX - panX) / zoom
    const canvasY = (screenY - panY) / zoom
    
    return {
      x: canvasX,
      y: canvasY
    }
  }

  const startDrawing = (e) => {
    e.preventDefault()
    
    // Don't start drawing if space is pressed (pan mode)
    if (isSpacePressed) {
      return
    }
    
    currentDrawingRecordId.current = Date.now()
    const coords = getCoordinates(e)
    lastPointRef.current = coords

    drawingManager.current.CreateNewDrawingRecord(
      currentDrawingRecordId.current,
      'stroke',
      currentColor,
      lineWidth
    )
    drawingManager.current.AddPointToRecord(currentDrawingRecordId.current, coords)

    socketManager.emitDrawingStart(currentDrawingRecordId.current, 'stroke', currentColor, lineWidth, roomId)
    socketManager.emitDrawingPoint(currentDrawingRecordId.current, coords, roomId)

    setIsDrawing(true)
  }

  const startPanning = (e) => {
    if (!isSpacePressed) return
    
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    panStartRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      panX: panX,
      panY: panY
    }
    setIsPanning(true)
  }

  const handlePanMove = (e) => {
    if (!isPanning || !panStartRef.current) return
    
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top
    
    const deltaX = currentX - panStartRef.current.x
    const deltaY = currentY - panStartRef.current.y
    
    setPanX(panStartRef.current.panX + deltaX)
    setPanY(panStartRef.current.panY + deltaY)
  }

  const stopPanning = () => {
    setIsPanning(false)
    panStartRef.current = null
  }

  const handleMouseMove = (e) => {
    // Handle panning if space is pressed and we're panning
    if (isSpacePressed && isPanning) {
      handlePanMove(e)
      return
    }
    
    // Handle drawing if we're drawing
    if (isDrawing) {
      draw(e)
    }
  }

  const draw = (e) => {
    e.preventDefault()
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const coords = getCoordinates(e)
    
    // Apply transformations for drawing
    ctx.save()
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)
    
    ctx.strokeStyle = currentColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()
    
    ctx.restore()

    drawingManager.current.AddPointToRecord(currentDrawingRecordId.current, coords)
    
    socketManager.emitDrawingPoint(currentDrawingRecordId.current, coords, roomId)
    
    lastPointRef.current = coords
  }

  const stopDrawing = (e) => {
    if (isDrawing && currentDrawingRecordId.current) {
      socketManager.emitDrawingEnd(currentDrawingRecordId.current, roomId)
      drawingManager.current.AddDrawingRecordToHistory(currentDrawingRecordId.current)
      updateUndoRedoState()
    }
    console.log(drawingManager.current.getDrawingRecords())
    setIsDrawing(false)
    lastPointRef.current = null
    
    // Also stop panning
    if (isPanning) {
      stopPanning()
    }
  }

  const handleWheel = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    
    const rect = canvas.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    
    // Calculate zoom delta
    const zoomDelta = -e.deltaY * 0.001
    const newZoom = Math.max(0.25, Math.min(4.0, zoom * Math.exp(zoomDelta)))
    
    // Calculate new pan to keep cursor position fixed
    const zoomRatio = newZoom / zoom
    const newPanX = mouseX - (mouseX - panX) * zoomRatio
    const newPanY = mouseY - (mouseY - panY) * zoomRatio
    
    setZoom(newZoom)
    setPanX(newPanX)
    setPanY(newPanY)
  }

  const updateUndoRedoState = () => {
    setCanUndo(drawingManager.current.canUndo())
    setCanRedo(drawingManager.current.canRedo())
  }

const handleUndo = useCallback(() => {
  const undoneRecord = drawingManager.current.UndoLastDrawingRecord();
  if (undoneRecord) {
    socketManager.emitUndo(undoneRecord.id, roomId);
  }
  updateUndoRedoState();
  redrawCanvas();
}, [roomId, redrawCanvas]);

const handleRedo = useCallback(() => {
  const redoneRecord = drawingManager.current.RedoLastDrawingRecord();
  if (redoneRecord) {
    socketManager.emitRedo(
      redoneRecord.id,
      redoneRecord.type,
      redoneRecord.color,
      redoneRecord.size,
      redoneRecord.points,
      roomId
    );
  }
  updateUndoRedoState();
  redrawCanvas();
}, [roomId, redrawCanvas]);

const latestHandlers = useRef({ handleUndo, handleRedo });

useEffect(() => {
  latestHandlers.current = { handleUndo, handleRedo };
});

useEffect(() => {
  const handleKeyDown = (e) => {
    const { handleUndo, handleRedo } = latestHandlers.current;
    const isMod = e.ctrlKey || e.metaKey;

    if (isMod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (drawingManager.current.canUndo()) handleUndo();
    }
    
    if (isMod && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
      e.preventDefault();
      if (drawingManager.current.canRedo()) handleRedo();
    }
    
    // Handle space key for panning
    if (e.key === ' ') {
      e.preventDefault();
      setIsSpacePressed(true);
    }
  };

  const handleKeyUp = (e) => {
    if (e.key === ' ') {
      setIsSpacePressed(false);
      setIsPanning(false);
      panStartRef.current = null;
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  return () => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
  };
}, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawingManager.current.clearDrawingRecords()
    updateUndoRedoState()
    
    socketManager.emitClearCanvas(roomId)
  }

  const handleJoinRoom = (e) => {
    // add some sort of validation to check if the room id is already in use
    e.preventDefault()
    const trimmedInput = roomInput.trim()
    if (trimmedInput) {
      if (trimmedInput.length < 3) {
        alert('Room ID must be at least 3 characters long')
        return
      } else if (trimmedInput.length > 10) {
        alert('Room ID must be less than 10 characters long')
        return
      } else if (!/^[a-zA-Z0-9]+$/.test(trimmedInput)) {
        alert('Room ID must contain only letters and numbers')
        return
      }
      setRoomId(roomInput.trim())
      socketManager.emitJoinRoom(trimmedInput)
    }
  }

  const handleLeaveRoom = () => {
    setRoomId(null)
    drawingManager.current.clearDrawingRecords()
    updateUndoRedoState()
    redrawCanvas()
  }

  if (!roomId) {
    return (
      <div className="landing-page">
        <div className="landing-card">
          <div className="landing-header">
            <h1>CollabBoard</h1>
            <p>Real-time collaborative drawing for teams</p>
          </div>
          <form className="join-form" onSubmit={handleJoinRoom}>
            <input
              type="text"
              placeholder="Enter Room Name..."
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!roomInput.trim()}>
              Join Board
            </button>
          </form>
          <div className="landing-footer">
            <span>Create a new room or join an existing one by entering the same name.</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <div className="toolbar">
        <div className="toolbar-section">
          <button className="action-btn back-btn" onClick={handleLeaveRoom}>
            ← Exit
          </button>
          <div className="room-info">
            <span className="toolbar-label">Room</span>
            <span className="room-name">{roomId}</span>
          </div>
        </div>

        <div className="toolbar-section">
          <span className="toolbar-label">Colors</span>
          <div className="color-picker">
            {COLORS.map((color) => (
              <button
                key={color.value}
                className={`color-btn ${currentColor === color.value ? 'active' : ''}`}
                style={{ backgroundColor: color.value }}
                onClick={() => setCurrentColor(color.value)}
                title={color.name}
              />
            ))}
          </div>
        </div>
        
        <div className="toolbar-section">
          <span className="toolbar-label">Size: {lineWidth}px</span>
          <input
            type="range"
            min="1"
            max="20"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="size-slider"
          />
        </div>
        
        <div className="toolbar-section">
          <button 
            className="action-btn" 
            onClick={handleUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            ↶ Undo
          </button>
          <button 
            className="action-btn" 
            onClick={handleRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            ↷ Redo
          </button>
        </div>
        
        <button className="clear-btn" onClick={clearCanvas}>
          Clear Canvas
        </button>
        
        <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
          <span className="status-dot"></span>
          <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>
      
      <div className="canvas-container">
        <canvas
          ref={canvasRef}
          onMouseDown={(e) => {
            if (isSpacePressed) {
              startPanning(e)
            } else {
              startDrawing(e)
            }
          }}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onWheel={handleWheel}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ cursor: isSpacePressed ? (isPanning ? 'grabbing' : 'grab') : 'crosshair' }}
        />
        
        {Object.entries(activeDrawers).map(([id, drawer]) => 
          drawer.position && (
            <div
              key={id}
              className="drawer-label"
              style={{
                left: drawer.position.x * zoom + panX + 10,
                top: drawer.position.y * zoom + panY - 25,
                backgroundColor: drawer.color,
              }}
            >
              {drawer.userName}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default App
