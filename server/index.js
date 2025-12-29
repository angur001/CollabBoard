import { Server } from 'socket.io'

const io = new Server(3001, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

// Store all drawing records to sync new users
// const allDrawingRecords = {}
// const userNames = {}

const rooms = {} // key is the room id, value is an object with the following properties: allDrawingRecords, userNames

const randomNameGenerator = () => {
  const names = ['Amina', 'Omar', 'Hassan', 'Layla', 'Noor', 'Ibrahim']
  const titles = ['Desertborn', 'Firehearted', 'Stormrider', 'Moonkeeper', 'Ironwill', 'Lightbringer']

  return `${names[Math.floor(Math.random() * names.length)]} the ${titles[Math.floor(Math.random() * titles.length)]}`
}


io.on('connection', (socket) => {
  // Send existing drawings to new user
  console.log('User connected:', socket.id)


  // User started a new stroke
  socket.on('drawing-start', (data) => {
    const { id, type, color, size, roomId } = data
    rooms[roomId].allDrawingRecords[id] = { type, color, size, points: [] }
    socket.to(roomId).emit('drawing-start', { ...data, userName: rooms[roomId].userNames[socket.id] })
  })

  // User is drawing (adding points)
  socket.on('drawing-point', (data) => {
    if (!data.id || typeof data.point?.x !== 'number' || typeof data.point?.y !== 'number') {
      return
    }
    if (allDrawingRecords[data.id]?.points.length > 10000) {
      return
    }
    const { id, point, roomId } = data
    if (rooms[roomId].allDrawingRecords[id]) {
      rooms[roomId].allDrawingRecords[id].points.push(point)
    }
    socket.to(roomId).emit('drawing-point', { ...data, userName: rooms[roomId].userNames[socket.id] })
  })

  // User finished drawing a stroke
  socket.on('drawing-end', (data) => {
    const { roomId } = data
    socket.to(roomId).emit('drawing-end', { ...data, userName: rooms[roomId].userNames[socket.id] })
  })

  // User undid a drawing
  socket.on('undo', (data) => {
    const { id, roomId } = data
    if (rooms[roomId].allDrawingRecords[id]) {
      delete rooms[roomId].allDrawingRecords[id]
    }
    socket.to(roomId).emit('undo', { ...data, userName: rooms[roomId].userNames[socket.id] })
  })

  // User redid a drawing
  socket.on('redo', (data) => {
    const { id, type, color, size, points, roomId } = data
    rooms[roomId].allDrawingRecords[id] = { type, color, size, points }
    socket.to(roomId).emit('redo', { ...data, userName: rooms[roomId].userNames[socket.id] })
  })

  // User cleared the canvas
  socket.on('clear-canvas', (data) => {
    const { roomId } = data
    for (const key in rooms[roomId].allDrawingRecords) {
      delete rooms[roomId].allDrawingRecords[key]
    }
    socket.to(roomId).emit('clear-canvas', { ...data, userName: rooms[roomId].userNames[socket.id] })
  })

  socket.on('join-room', (data) => {
    const { roomId } = data
    if (!rooms[roomId]) {
      console.log(`Room ${roomId} not found`)
      return
    }
    socket.join(roomId)
    const name = randomNameGenerator()
    rooms[roomId].userNames[socket.id] = name
    socket.emit('sync-drawings', rooms[roomId].allDrawingRecords)
  })

  socket.on('create-room', () => {
    const roomId = crypto.randomUUID()
    rooms[roomId] = { allDrawingRecords: {}, userNames: {} }
    socket.join(roomId)
    socket.emit('room-created', roomId)
  })

  socket.on('leave-room', (data) => {
    const { roomId } = data
    if (!rooms[roomId]) {
      console.log(`Room ${roomId} not found`)
      return
    }
    socket.leave(roomId)
    delete rooms[roomId].userNames[socket.id]
  })

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id)
  })
})

console.log('Socket server running on port 3001')

