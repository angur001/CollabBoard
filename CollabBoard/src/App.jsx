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

  if (drawingManager.current === null) {
    drawingManager.current = new DrawingManager()
  }

  // Redraw all strokes from the drawing manager
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    // Clear the canvas first
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
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
  }, [])

  // Used for drawing remote changes in real time
  const drawLineSegment = useCallback((fromPoint, toPoint, color, size) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    
    ctx.strokeStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    ctx.moveTo(fromPoint.x, fromPoint.y)
    ctx.lineTo(toPoint.x, toPoint.y)
    ctx.stroke()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    const resizeCanvas = () => {
      const rect = canvas.parentElement.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      
      // Set default styles
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      
      redrawCanvas()
    }
    
    resizeCanvas()
    window.addEventListener('resize', resizeCanvas)
    
    return () => window.removeEventListener('resize', resizeCanvas)
  }, [redrawCanvas])

  // Socket connection and event handlers
  useEffect(() => {
    socketManager.connect()

    // set connect and disconnet callbacks
    socketManager.onConnect(() => setIsConnected(true))
    socketManager.onDisconnect(() => setIsConnected(false))

    // Sync existing drawings when joining
    socketManager.onSyncDrawings((records) => {
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

    return () => {
      socketManager.disconnect()
    }
  }, [redrawCanvas, drawLineSegment])

  const getCoordinates = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    if (e.touches) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      }
    }
    
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }

  const startDrawing = (e) => {
    e.preventDefault()
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

    socketManager.emitDrawingStart(currentDrawingRecordId.current, 'stroke', currentColor, lineWidth)
    socketManager.emitDrawingPoint(currentDrawingRecordId.current, coords)

    setIsDrawing(true)
  }

  const draw = (e) => {
    if (!isDrawing) return
    e.preventDefault()
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const coords = getCoordinates(e)
    
    ctx.strokeStyle = currentColor
    ctx.lineWidth = lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    ctx.beginPath()
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y)
    ctx.lineTo(coords.x, coords.y)
    ctx.stroke()

    drawingManager.current.AddPointToRecord(currentDrawingRecordId.current, coords)
    
    socketManager.emitDrawingPoint(currentDrawingRecordId.current, coords)
    
    lastPointRef.current = coords
  }

  const stopDrawing = () => {
    if (isDrawing && currentDrawingRecordId.current) {
      socketManager.emitDrawingEnd(currentDrawingRecordId.current)
      drawingManager.current.AddDrawingRecordToHistory(currentDrawingRecordId.current)
      updateUndoRedoState()
    }
    console.log(drawingManager.current.getDrawingRecords())
    setIsDrawing(false)
    lastPointRef.current = null
  }

  const updateUndoRedoState = () => {
    setCanUndo(drawingManager.current.canUndo())
    setCanRedo(drawingManager.current.canRedo())
  }

const handleUndo = useCallback(() => {
  const undoneRecord = drawingManager.current.UndoLastDrawingRecord();
  if (undoneRecord) {
    socketManager.emitUndo(undoneRecord.id);
  }
  updateUndoRedoState();
  redrawCanvas();
}, []);

const handleRedo = useCallback(() => {
  const redoneRecord = drawingManager.current.RedoLastDrawingRecord();
  if (redoneRecord) {
    socketManager.emitRedo(
      redoneRecord.id,
      redoneRecord.type,
      redoneRecord.color,
      redoneRecord.size,
      redoneRecord.points
    );
  }
  updateUndoRedoState();
  redrawCanvas();
}, []);

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
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawingManager.current.clearDrawingRecords()
    updateUndoRedoState()
    
    socketManager.emitClearCanvas()
  }

  return (
    <div className="app">
      <div className="toolbar">
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
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {Object.entries(activeDrawers).map(([id, drawer]) => 
          drawer.position && (
            <div
              key={id}
              className="drawer-label"
              style={{
                left: drawer.position.x + 10,
                top: drawer.position.y - 25,
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
