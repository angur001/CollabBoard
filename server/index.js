import { Server } from 'socket.io'

const io = new Server(3001, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// Store all drawing records to sync new users
const allDrawingRecords = {}
const userNames = {}

const randomNameGenerator = () => {
  const names = ['Amina', 'Omar', 'Hassan', 'Layla', 'Noor', 'Ibrahim']
  const titles = ['Desertborn', 'Firehearted', 'Stormrider', 'Moonkeeper', 'Ironwill', 'Lightbringer']

  return `${names[Math.floor(Math.random() * names.length)]} the ${titles[Math.floor(Math.random() * titles.length)]}`
}


io.on('connection', (socket) => {
  console.log('User connected:', socket.id)
  const name = randomNameGenerator()
  userNames[socket.id] = name
  console.log(`User ${name} connected with ID: ${socket.id}`)

  // Send existing drawings to new user
  socket.emit('sync-drawings', allDrawingRecords)

  // User started a new stroke
  socket.on('drawing-start', (data) => {
    const { id, type, color, size } = data
    allDrawingRecords[id] = { type, color, size, points: [] }
    socket.broadcast.emit('drawing-start', { ...data, userName: userNames[socket.id] })
  })

  // User is drawing (adding points)
  socket.on('drawing-point', (data) => {
    const { id, point } = data
    if (allDrawingRecords[id]) {
      allDrawingRecords[id].points.push(point)
    }
    socket.broadcast.emit('drawing-point', { ...data, userName: userNames[socket.id] })
  })

  // User finished drawing a stroke
  socket.on('drawing-end', (data) => {
    socket.broadcast.emit('drawing-end', { ...data, userName: userNames[socket.id] })
  })

  // User undid a drawing
  socket.on('undo', (data) => {
    const { id } = data
    if (allDrawingRecords[id]) {
      delete allDrawingRecords[id]
    }
    socket.broadcast.emit('undo', { ...data, userName: userNames[socket.id] })
  })

  // User redid a drawing
  socket.on('redo', (data) => {
    const { id, type, color, size, points } = data
    allDrawingRecords[id] = { type, color, size, points }
    socket.broadcast.emit('redo', { ...data, userName: userNames[socket.id] })
  })

  // User cleared the canvas
  socket.on('clear-canvas', () => {
    for (const key in allDrawingRecords) {
      delete allDrawingRecords[key]
    }
    socket.broadcast.emit('clear-canvas')
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
    delete userNames[socket.id]
  })
})

console.log('Socket server running on port 3001')

