import { useRef, useState, useEffect, useCallback } from "react";
import collisions from "../../utils/collisions";
import InteractionMenu from "./InteractionMenu";
import Sprite from "./Sprite";
import axios from "axios";

const BOUNDARY_SIZE = 32;
const INTERACTION_RANGE = 50;
const MAP_WIDTH = 1524;
const MAP_HEIGHT = 776;

const useGame = (canvasRef, socketRef, keysRef) => {
  const [player, setPlayer] = useState(null);
  const [otherPlayers, setOtherPlayers] = useState({});
  const [boundaries, setBoundaries] = useState([]);
  const [playerName, setPlayerName] = useState("");
  const [playerCount, setPlayerCount] = useState(1);
  const [mapImage, setMapImage] = useState(null);
  const [backgroundImage, setBackgroundImage] = useState(null);
  const [playerImages, setPlayerImages] = useState(null);
  const gameContainerRef = useRef(null);
  const playerProximityState = useRef({});
  const interactionMenu = useRef(new InteractionMenu());
  const [imagesLoaded, setImagesLoaded] = useState(false); // <-- NEW
  const [isInArea2, setIsInArea2] = useState(false);
  const [meetingRoomCall, setMeetingRoomCall] = useState({
    active: false,
    localStream: null,
    remoteStreams: {}, // Changed to handle multiple streams
  });
  const meetingPeerConnections = useRef({}); // Store peer connections for meeting room
  const [iceConfig, setIceConfig] = useState(null); // <-- Add ICE config state

  // Load images
  useEffect(() => {
    const loadImage = (src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
          resolve(img);
        };
        img.onerror = (error) => {
          console.error(`Error loading image: ${src}`, error);
        };
      });
    };

    const loadAllImages = async () => {
      try {
        const [mapImg, bgImg, downImg, upImg, leftImg, rightImg] =
          await Promise.all([
            loadImage("/images/map.png"),
            loadImage("/images/background.png"),
            loadImage("/images/playerDown.png"),
            loadImage("/images/playerUp.png"),
            loadImage("/images/playerLeft.png"),
            loadImage("/images/playerRight.png"),
          ]);

        setMapImage(mapImg);
        setBackgroundImage(bgImg);
        setPlayerImages({
          down: downImg,
          up: upImg,
          left: leftImg,
          right: rightImg,
        });

        setImagesLoaded(true); // <-- set flag
        console.log("All images loaded successfully");
      } catch (error) {
        console.error("Error loading images:", error);
      }
    };

    loadAllImages();
  }, []);

  // Initialize boundaries
  useEffect(() => {
    const generated = collisions.flatMap((row, i) =>
      row
        .map((cell, j) =>
          cell === 1
            ? {
                x: j * BOUNDARY_SIZE,
                y: i * BOUNDARY_SIZE,
                width: BOUNDARY_SIZE - 5,
                height: BOUNDARY_SIZE - 10,
              }
            : null
        )
        .filter(Boolean)
    );
    setBoundaries(generated);
    console.log("Boundaries generated:", generated);
  }, []);

  // Fetch ICE servers from backend on mount
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const res = await axios.get("/api/ice-token");
        setIceConfig(res.data); // expects { iceServers: [...] }
      } catch (err) {
        console.error("Failed to fetch ICE servers:", err);
        setIceConfig({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      }
    };
    fetchIceServers();
  }, []);

  // Define all socket handlers with useCallback
  const handleCurrentPlayers = useCallback(
    (players) => {
      console.log("Received current players:", players);
      console.log("Player Images state (handleCurrentPlayers):", playerImages);
      const others = {};
      Object.entries(players).forEach(([id, data]) => {
        others[id] = new Sprite({
          position: data.position,
          image: playerImages?.[data.direction] || playerImages?.down,
          frames: { max: 4 },
          sprites: playerImages,
          name: data.name,
          id: id,
          speed: 3,
        });
      });
      setOtherPlayers(others);
      setPlayerCount(Object.keys(players).length + 1);
    },
    [playerImages]
  );

  const handleNewPlayer = useCallback(
    (playerInfo) => {
      console.log("New player joined:", playerInfo);
      console.log("Player Images state (handleNewPlayer):", playerImages);
      setOtherPlayers((prev) => ({
        ...prev,
        [playerInfo.id]: new Sprite({
          position: playerInfo.position,
          image: playerImages?.[playerInfo.direction] || playerImages?.down,
          frames: { max: 4 },
          sprites: playerImages,
          name: playerInfo.name,
          id: playerInfo.id,
          speed: 3,
          lastDirection: playerInfo.direction || "down",
          moving: playerInfo.moving || false,
        }),
      }));
      setPlayerCount((prev) => prev + 1);
    },
    [playerImages]
  );

  // const handlePlayerMoved = useCallback(
  //   (playerInfo) => {
  //     //console.log('Player moved:', playerInfo);
  //     setOtherPlayers((prev) => {
  //       const existing = prev[playerInfo.id];
  //       if (existing) {
  //         const updatedPlayer = new Sprite({
  //           position: playerInfo.position,
  //           image: playerImages?.[playerInfo.direction] || playerImages?.down,
  //           frames: { max: 4 },
  //           sprites: playerImages,
  //           name: existing.name,
  //           id: existing.id,
  //           speed: existing.speed,
  //           lastDirection: playerInfo.direction,
  //           moving: playerInfo.moving,
  //         });
  //         return {
  //           ...prev,
  //           [playerInfo.id]: updatedPlayer,
  //         };
  //       }
  //       return prev;
  //     });
  //   },
  //   [playerImages]
  // );

  const handlePlayerMoved = useCallback(
    (playerInfo) => {
      setOtherPlayers((prev) => {
        const existing = prev[playerInfo.id];
        if (existing) {
          // Update all fields, including name!
          return {
            ...prev,
            [playerInfo.id]: new Sprite({
              position: playerInfo.position,
              image: playerImages?.[playerInfo.direction] || playerImages?.down,
              frames: { max: 4 },
              sprites: playerImages,
              name: playerInfo.name, // <-- make sure this is updated!
              id: playerInfo.id,
              speed: existing.speed,
              lastDirection: playerInfo.direction,
              moving: playerInfo.moving,
            }),
          };
        }
        return prev;
      });
    },
    [playerImages]
  );

  const handlePlayerDisconnected = useCallback((playerId) => {
    console.log("Player disconnected:", playerId);
    setOtherPlayers((prev) => {
      const newPlayers = { ...prev };
      delete newPlayers[playerId];
      return newPlayers;
    });
    setPlayerCount((prev) => prev - 1);
  }, []);

  // In your useGame.js, modify the socket effect:

  useEffect(() => {
    if (!socketRef.current) return;

    const socket = socketRef.current;
    console.log("Setting up socket listeners...");

    // Set up listeners immediately
    socket.on("currentPlayers", handleCurrentPlayers);
    socket.on("newPlayer", handleNewPlayer);
    socket.on("playerMoved", handlePlayerMoved);
    socket.on("playerDisconnected", handlePlayerDisconnected);

    socket.on("connect", () => {
      console.log("Socket connected, id:", socket.id);
    });

    // When images are loaded, request players again
    if (imagesLoaded) {
      console.log("Images loaded, requesting current players");
      socket.emit("requestPlayers");
    }

    return () => {
      console.log("Cleaning up socket listeners...");
      socket.off("currentPlayers", handleCurrentPlayers);
      socket.off("newPlayer", handleNewPlayer);
      socket.off("playerMoved", handlePlayerMoved);
      socket.off("playerDisconnected", handlePlayerDisconnected);
    };
  }, [
    socketRef,
    imagesLoaded,
    handleCurrentPlayers,
    handleNewPlayer,
    handlePlayerMoved,
    handlePlayerDisconnected,
  ]);

  // Collision detection
  const checkCollision = useCallback(
    (x, y) => {
      return boundaries.some(
        (boundary) =>
          x < boundary.x + boundary.width &&
          x + 30 > boundary.x &&
          y < boundary.y + boundary.height &&
          y + 30 > boundary.y
      );
    },
    [boundaries]
  );

  // Find valid spawn position
  const findValidSpawnPosition = useCallback(() => {
    for (let i = 0; i < 100; i++) {
      const x = Math.floor(Math.random() * (MAP_WIDTH - 60)) + 30;
      const y = Math.floor(Math.random() * (MAP_HEIGHT - 60)) + 30;

      if (!checkCollision(x, y)) {
        console.log("Found valid spawn position:", { x, y });
        return { x, y };
      }
    }
    console.warn("Default spawn position used");
    return { x: 100, y: 100 };
  }, [checkCollision]);

  // Player interactions
  const checkPlayerInteraction = useCallback(() => {
    if (!player) return;

    if (interactionMenu.current.visible) {
      console.log("Interaction menu visible, hiding menu.");
      interactionMenu.current.hide();
      return;
    }

    const nearbyPlayer = Object.entries(otherPlayers).find(
      ([id, otherPlayer]) => {
        const dx = player.position.x - otherPlayer.position.x;
        const dy = player.position.y - otherPlayer.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance <= INTERACTION_RANGE;
      }
    );

    if (nearbyPlayer) {
      const [id, otherPlayer] = nearbyPlayer;
      const centerX =
        otherPlayer.position.x +
        (otherPlayer.width ? otherPlayer.width / 2 : 0);
      const centerY = otherPlayer.position.y;
      console.log("Nearby player found for interaction:", id, {
        x: centerX,
        y: centerY,
      });
      interactionMenu.current.show(id, { x: centerX, y: centerY });

      // Notify other player about the interaction
      if (socketRef.current) {
        socketRef.current.emit("playerInteraction", { targetId: id });
        console.log("Emitted playerInteraction event with targetId:", id);
      }
    }
  }, [player, otherPlayers, socketRef]);

  // Check if a position is in area 2
  const checkArea2 = useCallback((x, y) => {
    // Convert pixel position to grid position
    const gridX = Math.floor(x / BOUNDARY_SIZE);
    const gridY = Math.floor(y / BOUNDARY_SIZE);

    // Check if the grid position contains 2
    return collisions[gridY]?.[gridX] === 2;
  }, []);

  // Handle meeting room WebRTC
  const initializeMeetingRoomCall = useCallback(async () => {
    if (!iceConfig) return; // Wait for ICE config
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setMeetingRoomCall((prev) => ({
        ...prev,
        active: true,
        localStream: stream,
      }));

      // Function to create peer connection for a participant
      const createPeerConnection = async (participantId) => {
        if (meetingPeerConnections.current[participantId]) {
          return meetingPeerConnections.current[participantId];
        }
        // --- Ensure RTCConfiguration is always valid and log it ---
        let rtcConfig = iceConfig;
        if (
          !rtcConfig ||
          typeof rtcConfig !== "object" ||
          !Array.isArray(rtcConfig.iceServers)
        ) {
          rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
        }
        console.log("MeetingRoom: Using RTCConfiguration for", participantId, rtcConfig);

        let pc;
        try {
          pc = new RTCPeerConnection(rtcConfig);
        } catch (err) {
          console.error("MeetingRoom: Failed to create RTCPeerConnection for", participantId, err, rtcConfig);
          throw err;
        }
        meetingPeerConnections.current[participantId] = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit("meeting-ice-candidate", {
              to: participantId,
              candidate: event.candidate,
            });
          }
        };

        pc.ontrack = (event) => {
          // Only set remote stream if it's not our own stream
          if (event.streams && event.streams[0] && event.streams[0].id !== stream.id) {
            setMeetingRoomCall((prev) => {
              return {
                ...prev,
                remoteStreams: {
                  ...prev.remoteStreams,
                  [participantId]: event.streams[0],
                },
              };
            });
          }
        };

        pc.onconnectionstatechange = () => {
          console.log(`MeetingRoom: Peer ${participantId} connection state:`, pc.connectionState);
        };

        return pc;
      };

      // Remove previous listeners to avoid duplicates
      socketRef.current.off("meeting-user-joined");
      socketRef.current.off("meeting-offer");
      socketRef.current.off("meeting-answer");
      socketRef.current.off("meeting-ice-candidate");
      socketRef.current.off("meeting-user-left");
      socketRef.current.off("meeting-existing-participants");

      // --- Only the new participant creates offers to existing participants ---
      let isInitiator = false;

      socketRef.current.on("meeting-user-joined", async ({ userId }) => {
        // If you receive this event, you are an existing participant.
        // Do NOT create an offer. Wait for the new user to create offers to you.
        // Just set up the peer connection when you receive an offer.
      });

      // ICE candidate queueing for reliability
      const candidateQueue = {};
      socketRef.current.on(
        "meeting-ice-candidate",
        async ({ from, candidate }) => {
          const pc = meetingPeerConnections.current[from];
          if (pc) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              // Queue ICE candidates until remoteDescription is set
              if (!candidateQueue[from]) candidateQueue[from] = [];
              candidateQueue[from].push(candidate);
            }
          }
        }
      );

      socketRef.current.on("meeting-offer", async ({ from, offer }) => {
        const pc = await createPeerConnection(from);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Add any queued ICE candidates
        if (candidateQueue[from]) {
          for (const cand of candidateQueue[from]) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          candidateQueue[from] = [];
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit("meeting-answer", { to: from, answer });
      });

      socketRef.current.on("meeting-answer", async ({ from, answer }) => {
        const pc = meetingPeerConnections.current[from];
        // Only set remote answer if in correct signaling state
        if (pc && pc.signalingState === "have-local-offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
          console.warn(
            `Skipping setRemoteDescription(answer) for ${from} because signalingState is ${
              pc ? pc.signalingState : "undefined"
            }`
          );
        }
      });

      socketRef.current.on(
        "meeting-ice-candidate",
        async ({ from, candidate }) => {
          const pc = meetingPeerConnections.current[from];
          if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        }
      );

      socketRef.current.on("meeting-user-left", ({ userId }) => {
        setMeetingRoomCall((prev) => {
          const newRemoteStreams = { ...prev.remoteStreams };
          delete newRemoteStreams[userId];
          return { ...prev, remoteStreams: newRemoteStreams };
        });

        if (meetingPeerConnections.current[userId]) {
          meetingPeerConnections.current[userId].close();
          delete meetingPeerConnections.current[userId];
        }
      });

      // Join the meeting room and get the list of existing participants
      socketRef.current.emit("joinMeetingRoom");

      // Listen for the list of existing participants (sent by server after join)
      socketRef.current.once(
        "meeting-existing-participants",
        async ({ participants }) => {
          // You are the new participant, create offers to all existing participants
          isInitiator = true;
          for (const participantId of participants) {
            if (participantId === socketRef.current.id) continue;
            const pc = await createPeerConnection(participantId);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit("meeting-offer", {
              to: participantId,
              offer,
            });
          }
        }
      );
    } catch (error) {
      console.error("Error initializing meeting room call:", error);
    }
  }, [iceConfig]);

  // Clean up meeting room call
  const cleanupMeetingRoom = useCallback(() => {
    if (meetingRoomCall.localStream) {
      meetingRoomCall.localStream.getTracks().forEach((track) => track.stop());
    }

    Object.values(meetingPeerConnections.current).forEach((pc) => pc.close());
    meetingPeerConnections.current = {};

    setMeetingRoomCall({ active: false, localStream: null, remoteStreams: {} });

    if (socketRef.current) {
      socketRef.current.emit("leaveMeetingRoom");
    }
  }, [meetingRoomCall.localStream]);

  // Player proximity checks
  const checkNearbyPlayers = useCallback(() => {
    if (!player) return;

    // Check if player is in area 2
    const isNowInArea2 = checkArea2(player.position.x, player.position.y);

    if (isNowInArea2 && !isInArea2) {
      console.log("Player entered the meeting room area");
      setIsInArea2(true);
      initializeMeetingRoomCall(); // <-- Start meeting room call
    } else if (!isNowInArea2 && isInArea2) {
      setIsInArea2(false);
      cleanupMeetingRoom(); // <-- Leave meeting room call
    }

    Object.entries(otherPlayers).forEach(([id, otherPlayer]) => {
      const dx = player.position.x - otherPlayer.position.x;
      const dy = player.position.y - otherPlayer.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const isNearby = distance <= INTERACTION_RANGE;
      const wasNearby = playerProximityState.current[id] || false;
      playerProximityState.current[id] = isNearby;

      if (!wasNearby && isNearby) {
        console.log(`[DEBUG] ${otherPlayer.name} is nearby!`);
      } else if (wasNearby && !isNearby) {
        console.log(`[DEBUG] ${otherPlayer.name} left the area`);
      }
    });
  }, [
    player,
    otherPlayers,
    checkArea2,
    isInArea2,
    initializeMeetingRoomCall,
    cleanupMeetingRoom,
  ]);

  return {
    player,
    setPlayer,
    otherPlayers,
    setOtherPlayers,
    boundaries,
    interactionMenu,
    playerName,
    setPlayerName,
    playerCount,
    setPlayerCount,
    gameContainerRef,
    checkCollision,
    findValidSpawnPosition,
    checkPlayerInteraction,
    checkNearbyPlayers,
    mapImage,
    backgroundImage,
    playerImages,
    isInArea2,
    meetingRoomCall,
    setMeetingRoomCall,
  };
};

export default useGame;
