const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const iceTokenRoute = require("./routes/ice-token");

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const app = express();
app.use(cors());
app.use(express.static("uploads")); // Serve static files from uploads directory
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://g-blush-five.vercel.app/", // <-- add your deployed frontend domain here
    ],
    methods: ["GET", "POST"],
  },
});

// Game state
const players = {};

// Chat state
const chatMap = new Map();
const users = {}; // Map usernames to socket IDs

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

app.use("/api/ice-token", iceTokenRoute);

// File upload endpoint
app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  res.json({
    filePath: `https://g-production-e033.up.railway.app/${req.file.filename}`,
  });
});

// Meeting room state
const meetingRoomParticipants = new Set();

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ===== GAME FUNCTIONALITY =====

  // Add new player to the game
  const newPlayer = {
    position: { x: 300, y: 300 },
    direction: "down",
    name: `Player-${socket.id.substr(0, 4)}`,
    id: socket.id,
    moving: false,
  };
  players[socket.id] = newPlayer;

  // Send existing players to NEW player (excluding self)
  const otherPlayers = Object.fromEntries(
    Object.entries(players).filter(([id]) => id !== socket.id)
  );
  console.log("Current players sent to new player:", otherPlayers);
  socket.emit("currentPlayers", otherPlayers);

  // Tell EXISTING players about the NEW player
  socket.broadcast.emit("newPlayer", newPlayer);

  // Allow client to request players list again when ready
  socket.on("requestPlayers", () => {
    const currentOtherPlayers = Object.fromEntries(
      Object.entries(players).filter(([id]) => id !== socket.id)
    );
    console.log("Re-sending current players on request:", currentOtherPlayers);
    socket.emit("currentPlayers", currentOtherPlayers);
  });

  // Handle player movement
  socket.on("playerMovement", (movementData) => {
    if (players[socket.id]) {
      players[socket.id] = {
        ...players[socket.id],
        ...movementData,
      };
      // Broadcast to ALL players
      io.emit("playerMoved", players[socket.id]);
    }
  });

  // ===== CHAT FUNCTIONALITY =====

  // User registration
  socket.on("register", (username) => {
    users[username] = socket.id;

    // Update player name if exists
    if (players[socket.id]) {
      players[socket.id].name = username;
      io.emit("playerMoved", players[socket.id]);
    }

    console.log(`User ${username} connected with ID ${socket.id}`);
    io.emit("onlineUserswithnames", users);
  });

  // Send message
  socket.on("sendMessage", ({ listner, message }) => {
    console.log(`Message from ${socket.id} to ${listner}: ${message}`);

    // Normalize the key by sorting the array
    const key = [listner, socket.id].sort().join("|");

    // Check if the chat already exists between these two users
    if (!chatMap.has(key)) {
      // If not, initialize an empty array for their chat
      chatMap.set(key, []);
    }

    // Get username of sender
    const senderUsername =
      Object.keys(users).find((key) => users[key] === socket.id) ||
      (players[socket.id]
        ? players[socket.id].name
        : `Unknown-${socket.id.substr(0, 4)}`);

    // Add the message along with sender info to the chat
    chatMap.get(key).push({
      sender: socket.id,
      message,
      senderUsername: senderUsername,
    });

    // Emit the message to both parties
    io.to(listner).emit("receive_message_sec", chatMap.get(key), socket.id);
    socket.emit("receive_message", chatMap.get(key));
  });

  // Get chat history
  socket.on("getchathistory", (userKey) => {
    const key = [userKey, socket.id].sort().join("|");

    // Check if the chat already exists between these two users
    if (!chatMap.has(key)) {
      // If not, initialize an empty array for their chat
      chatMap.set(key, []);
    }

    socket.emit("receive_message", chatMap.get(key));
  });

  // ===== VOICE CALL POPUP FUNCTIONALITY =====
  socket.on("callUser", ({ targetId, callerName }) => {
    // Send a popup event to the target user with caller info
    io.to(targetId).emit("receiveCall", {
      callerId: socket.id,
      callerName:
        callerName ||
        players[socket.id]?.name ||
        `Player-${socket.id.substr(0, 4)}`,
    });
  });

  // WebRTC signaling relay
  socket.on("offer", ({ to, offer }) => {
    io.to(to).emit("offer", { from: socket.id, offer });
  });
  socket.on("answer", ({ to, answer }) => {
    io.to(to).emit("answer", { from: socket.id, answer });
  });
  socket.on("ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("ice-candidate", { from: socket.id, candidate });
  });
  socket.on("acceptCall", ({ to }) => {
    io.to(to).emit("acceptCall", { from: socket.id });
  });
  socket.on("endCall", ({ to }) => {
    io.to(to).emit("endCall");
  });

  // Meeting room handling
  socket.on("joinMeetingRoom", () => {
    meetingRoomParticipants.add(socket.id);

    // Notify existing participants about new user (but NOT the joining user)
    socket.broadcast.emit("meeting-user-joined", { userId: socket.id });

    // Send the list of existing participants to the joining user
    socket.emit("meeting-existing-participants", {
      participants: Array.from(meetingRoomParticipants).filter(
        (id) => id !== socket.id
      ),
    });
  });

  socket.on("leaveMeetingRoom", () => {
    meetingRoomParticipants.delete(socket.id);
    io.emit("meeting-user-left", { userId: socket.id });
  });

  // Meeting room WebRTC signaling
  socket.on("meeting-offer", ({ to, offer }) => {
    io.to(to).emit("meeting-offer", { from: socket.id, offer });
  });

  socket.on("meeting-answer", ({ to, answer }) => {
    io.to(to).emit("meeting-answer", { from: socket.id, answer });
  });

  socket.on("meeting-ice-candidate", ({ to, candidate }) => {
    io.to(to).emit("meeting-ice-candidate", { from: socket.id, candidate });
  });

  // Handle disconnections
  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);

    // Game cleanup
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);

    // Chat cleanup
    const username = Object.keys(users).find((key) => users[key] === socket.id);
    if (username) {
      delete users[username];
      console.log(`User ${username} disconnected`);
    }

    // Notify clients about updated online users
    io.emit("onlineUserswithnames", users);

    // Meeting room cleanup
    meetingRoomParticipants.delete(socket.id);
    io.emit("participantLeft", { id: socket.id });

    // Meeting room cleanup
    if (meetingRoomParticipants.has(socket.id)) {
      meetingRoomParticipants.delete(socket.id);
      io.emit("meeting-user-left", { userId: socket.id });
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
