import { useRef, useState, useEffect } from 'react'
import './index.css'
import DrawingManager from './drawingManager'

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


  if (drawingManager.current === null) {
    drawingManager.current = new DrawingManager()
  }

  // Redraw all strokes from the drawing manager
  const redrawCanvas = () => {
    const canvas = canvasRef.current
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
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Set canvas size to fill the drawing area
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
  }, [])

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
    
    lastPointRef.current = coords
  }

  const stopDrawing = () => {
    console.log(drawingManager.current.getDrawingRecords())
    setIsDrawing(false)
    lastPointRef.current = null
  }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    drawingManager.current.clearDrawingRecords()
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
        
        <button className="clear-btn" onClick={clearCanvas}>
          Clear Canvas
        </button>
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
      </div>
    </div>
  )
}

export default App
