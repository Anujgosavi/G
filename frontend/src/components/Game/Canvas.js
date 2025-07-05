import React, { useEffect, useRef, useState, useCallback } from "react";
import collisions from "../../utils/collisions";
import Sprite from "./Sprite";
import io from "socket.io-client";
import "./styles.css";
import useGame from "./useGame";
import Chat from "./chat";
import { MessageCircle } from "lucide-react";
import { Mic, MicOff, Video, VideoOff } from "lucide-react";
import axios from "axios";

const Canvas = () => {
  const canvasRef = useRef(null);
  const [ctx, setCtx] = useState(null);
  const socketRef = useRef(null);
  const animationFrameRef = useRef(null);
  const keysRef = useRef({
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    e: false,
  });
  const [showChat, setShowChat] = useState(false);
  const [showNameModal, setShowNameModal] = useState(true);
  const [tempPlayerName, setTempPlayerName] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [videoCall, setVideoCall] = useState({
    active: false,
    localStream: null,
    remoteStream: null,
  });
  const peerConnectionRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localVideoRef = useRef(null);
  const [callPeerId, setCallPeerId] = useState(null);
  const [iceConfig, setIceConfig] = useState(null);
  const iceCandidateQueue = useRef({}); // { peerId: [candidates] }
  const [toast, setToast] = useState(null);
  const [toastProgress, setToastProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [meetingMuteStates, setMeetingMuteStates] = useState({}); // { userId: boolean }
  const [meetingNameMap, setMeetingNameMap] = useState({}); // { userId: name }

  const {
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
  } = useGame(canvasRef, socketRef, keysRef);

  // Initialize canvas and socket
  const SOCKET_URL = "https://gather-here-we-go-again-production.up.railway.app/" // your production backend URL
      

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    setCtx(context);
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] }); // use correct URL and force websocket

    return () => {
      socketRef.current.disconnect();
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Fetch ICE servers from backend on mount
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const res = await axios.get("https://gather-here-we-go-again-production.up.railway.app/api/ice-token");
        setIceConfig(res.data); // expects { iceServers: [...] }
      } catch (err) {
        console.error("Failed to fetch ICE servers:", err);
        // fallback to public STUN if needed
        setIceConfig({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
      }
    };
    fetchIceServers();
  }, []);

  // Handle name submission
  const handleNameSubmit = () => {
    if (!tempPlayerName.trim()) return alert("Please enter a valid name");
    setPlayerName(tempPlayerName);
    setShowNameModal(false);

    // Register the name with the socket
    if (socketRef.current) {
      socketRef.current.emit("register", tempPlayerName);
    }
  };

  // Game initialization - now depends on playerName being set
  useEffect(() => {
    if (!ctx || !socketRef.current || !playerName || !mapImage) return;

    const initialPlayer = new Sprite({
      position: findValidSpawnPosition(),
      image: playerImages.down,
      frames: { max: 4 },
      sprites: playerImages,
      name: playerName,
      speed: 3,
    });
    setPlayer(initialPlayer);
  }, [
    ctx,
    playerName,
    setPlayer,
    findValidSpawnPosition,
    mapImage,
    playerImages,
  ]);

  // Handle key presses for interaction
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "e" || e.key === "E") {
        checkPlayerInteraction();
      }
      if (e.key in keysRef.current) {
        keysRef.current[e.key] = true;
      }
    };

    const handleKeyUp = (e) => {
      if (e.key in keysRef.current) {
        keysRef.current[e.key] = false;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [checkPlayerInteraction]);

  // Mouse events for interaction menu
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      interactionMenu.current.handleMouseMove(mouseX, mouseY);
    };

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      interactionMenu.current.handleClick(otherPlayers);
    };

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("click", handleClick);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("click", handleClick);
    };
  }, [otherPlayers]);

  // Listen for incoming call popup
  useEffect(() => {
    if (!socketRef.current) return;
    const handleReceiveCall = (data) => {
      setIncomingCall(data);
    };
    socketRef.current.on("receiveCall", handleReceiveCall);
    return () => {
      socketRef.current.off("receiveCall", handleReceiveCall);
    };
  }, []);

  // Patch interaction menu to trigger call
  useEffect(() => {
    if (!interactionMenu.current) return;
    const originalHandleClick = interactionMenu.current.handleClick.bind(
      interactionMenu.current
    );
    interactionMenu.current.handleClick = (otherPlayers) => {
      if (
        interactionMenu.current.visible &&
        interactionMenu.current.selectedOption === "voiceChat" &&
        interactionMenu.current.targetId
      ) {
        // Initialize caller's side of the call
        setCallPeerId(interactionMenu.current.targetId);
        setVideoCall((vc) => ({ ...vc, active: true }));

        // Send call event to server
        if (socketRef.current) {
          socketRef.current.emit("callUser", {
            targetId: interactionMenu.current.targetId,
            callerName: playerName,
          });
        }
        interactionMenu.current.hide();
        return true;
      }
      return originalHandleClick(otherPlayers);
    };
    return () => {
      interactionMenu.current.handleClick = originalHandleClick;
    };
  }, [interactionMenu, playerName]);

  // Accept incoming call
  const handleAcceptCall = async () => {
    try {
      if (!iceConfig) return; // Wait for ICE config
      setIncomingCall(null);
      setCallPeerId(incomingCall.callerId); // <-- Fix: use incomingCall.callerId, not interactingMenu
      setVideoCall((vc) => ({ ...vc, active: true }));

      // Get local media
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setVideoCall((vc) => ({ ...vc, localStream }));

      // --- Ensure RTCConfiguration is always valid ---
      let rtcConfig = iceConfig;
      if (
        !rtcConfig ||
        typeof rtcConfig !== "object" ||
        !Array.isArray(rtcConfig.iceServers)
      ) {
        rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
      }
      const pc = new window.RTCPeerConnection(rtcConfig);
      peerConnectionRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
      };

      // Add local tracks
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      // Send ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit("ice-candidate", {
            to: incomingCall.callerId,
            candidate: event.candidate,
          });
        }
      };

      // Receive remote stream
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setVideoCall((vc) => ({ ...vc, remoteStream: event.streams[0] }));
        }
      };

      // Remove any existing listeners
      socketRef.current.off("offer");
      socketRef.current.off("ice-candidate");

      // ICE candidate queue for this peer
      iceCandidateQueue.current[incomingCall.callerId] = [];

      // Create and send answer
      socketRef.current.on("offer", async ({ from, offer }) => {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        // Add queued ICE candidates for this peer
        if (iceCandidateQueue.current[from]) {
          for (const candidate of iceCandidateQueue.current[from]) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch (err) {
              console.error("Error adding queued ICE candidate:", err);
            }
          }
          iceCandidateQueue.current[from] = [];
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socketRef.current.emit("answer", { to: from, answer });
      });

      // Listen for ICE candidates
      socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
        try {
          if (candidate) {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } else {
              // Queue ICE candidates until remoteDescription is set
              if (!iceCandidateQueue.current[from]) iceCandidateQueue.current[from] = [];
              iceCandidateQueue.current[from].push(candidate);
            }
          }
        } catch (err) {
          console.error("Error adding received ICE candidate:", err);
        }
      });

      // Notify caller to start offer
      socketRef.current.emit("acceptCall", { to: incomingCall.callerId });
    } catch (error) {
      console.error("Error in handleAcceptCall:", error);
      handleEndCall();
    }
  };

  // Initiate call as caller
  useEffect(() => {
    if (!callPeerId || !videoCall.active || !iceConfig) return;

    let pc;
    let localStream;

    const startCaller = async () => {
      try {
        if (peerConnectionRef.current) {
          peerConnectionRef.current.close();
          peerConnectionRef.current = null;
        }

        // Get local media
        localStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setVideoCall((vc) => ({ ...vc, localStream }));

        // --- FIX: Ensure RTCConfiguration is always valid ---
        let rtcConfig = iceConfig;
        if (
          !rtcConfig ||
          typeof rtcConfig !== "object" ||
          !Array.isArray(rtcConfig.iceServers)
        ) {
          rtcConfig = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };
        }
        pc = new window.RTCPeerConnection(rtcConfig);
        peerConnectionRef.current = pc;

        pc.oniceconnectionstatechange = () => {
          console.log("Caller ICE connection state:", pc.iceConnectionState);
        };

        // Add local tracks
        localStream.getTracks().forEach((track) => {
          pc.addTrack(track, localStream);
        });

        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit("ice-candidate", {
              to: callPeerId,
              candidate: event.candidate,
            });
          }
        };

        pc.ontrack = (event) => {
          if (event.streams && event.streams[0]) {
            setVideoCall((vc) => ({ ...vc, remoteStream: event.streams[0] }));
          }
        };

        // Remove existing listeners
        socketRef.current.off("answer");
        socketRef.current.off("ice-candidate");
        socketRef.current.off("acceptCall");

        // ICE candidate queue for this peer
        iceCandidateQueue.current[callPeerId] = [];

        socketRef.current.on("answer", async ({ from, answer }) => {
          if (pc.signalingState !== "closed") {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
            // Add queued ICE candidates for this peer
            if (iceCandidateQueue.current[from]) {
              for (const candidate of iceCandidateQueue.current[from]) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                  console.error("Error adding queued ICE candidate:", err);
                }
              }
              iceCandidateQueue.current[from] = [];
            }
          }
        });

        socketRef.current.on("ice-candidate", async ({ from, candidate }) => {
          try {
            if (candidate) {
              if (pc.remoteDescription && pc.remoteDescription.type) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                if (!iceCandidateQueue.current[from]) iceCandidateQueue.current[from] = [];
                iceCandidateQueue.current[from].push(candidate);
              }
            }
          } catch (err) {
            console.error("Error adding received ICE candidate:", err);
          }
        });

        socketRef.current.on("acceptCall", async () => {
          try {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current.emit("offer", { to: callPeerId, offer });
          } catch (error) {
            console.error("Error creating offer:", error);
          }
        });
      } catch (error) {
        console.error("Error in startCaller:", error);
        handleEndCall();
      }
    };

    startCaller();

    return () => {
      console.log("Cleaning up caller effect");
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (pc) {
        pc.close();
      }
    };
  }, [callPeerId, videoCall.active, iceConfig]);

  // Cleanup on call end
  const handleEndCall = () => {
    setVideoCall({ active: false, localStream: null, remoteStream: null });
    setCallPeerId(null);
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    if (localVideoRef.current && localVideoRef.current.srcObject) {
      localVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
    }
    if (remoteVideoRef.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
    }
    if (socketRef.current && callPeerId) {
      socketRef.current.emit("endCall", { to: callPeerId });
    }
    setToast("Call ended");
    setToastProgress(0);
  };

  // Animate toast visibility (no progress bar)
  useEffect(() => {
    if (!toast) return;
    const duration = 2000;
    const timeout = setTimeout(() => {
      setToast(null);
      setToastProgress(0);
    }, duration);
    return () => clearTimeout(timeout);
  }, [toast]);

  // Attach streams to video elements with error handling
  useEffect(() => {
    console.log("Attaching streams to video elements");
    if (localVideoRef.current && videoCall.localStream) {
      console.log("Setting local video stream");
      localVideoRef.current.srcObject = videoCall.localStream;
    }
    if (remoteVideoRef.current && videoCall.remoteStream) {
      console.log("Setting remote video stream");
      remoteVideoRef.current.srcObject = videoCall.remoteStream;
    }

    // Add onloadedmetadata handlers
    const localVideo = localVideoRef.current;
    const remoteVideo = remoteVideoRef.current;

    if (localVideo) {
      localVideo.onloadedmetadata = () =>
        console.log("Local video metadata loaded");
      localVideo.onerror = (e) => console.error("Local video error:", e);
    }
    if (remoteVideo) {
      remoteVideo.onloadedmetadata = () =>
        console.log("Remote video metadata loaded");
      remoteVideo.onerror = (e) => console.error("Remote video error:", e);
    }
  }, [videoCall.localStream, videoCall.remoteStream]);

  // Listen for call end from peer
  useEffect(() => {
    if (!socketRef.current) return;
    const handlePeerEnd = () => handleEndCall();
    socketRef.current.on("endCall", handlePeerEnd);
    return () => socketRef.current.off("endCall", handlePeerEnd);
  }, [callPeerId]);

  // Listen for player names in meeting room
  useEffect(() => {
    if (!socketRef.current) return;

    // Listen for a mapping of userId to name
    const handleMeetingNames = (data) => {
      setMeetingNameMap(data || {});
    };

    socketRef.current.on("meeting-names", handleMeetingNames);

    // Request names when entering meeting room
    if (meetingRoomCall.active) {
      socketRef.current.emit("requestMeetingNames");
    }

    return () => {
      socketRef.current.off("meeting-names", handleMeetingNames);
    };
  }, [meetingRoomCall.active]);

  // Send our name to others when joining meeting room
  useEffect(() => {
    if (!socketRef.current || !meetingRoomCall.active || !playerName) return;
    socketRef.current.emit("announceMeetingName", { name: playerName });
  }, [meetingRoomCall.active, playerName]);

  // Game loop
  const animate = useCallback(() => {
    if (!player || !ctx || !mapImage) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    // Draw background
    if (backgroundImage) {
      ctx.drawImage(
        backgroundImage,
        0,
        0,
        canvasRef.current.width,
        canvasRef.current.height
      );
    }

    // Draw map
    ctx.drawImage(mapImage, 0, 0, 1550, 700);

    // --- Draw boundaries (make them visible) ---
    ctx.save();
    ctx.strokeStyle = "rgba(255,0,0,0)"; // Red, semi-transparent
    ctx.lineWidth = 2;
    boundaries.forEach((boundary) => {
      ctx.strokeRect(boundary.x, boundary.y, boundary.width, boundary.height);
    });
    ctx.restore();
    // --- End boundary drawing ---

    // Update player movement
    let moved = false;
    const directions = [
      { key: "ArrowUp", dx: 0, dy: -1, dir: "up" },
      { key: "ArrowDown", dx: 0, dy: 1, dir: "down" },
      { key: "ArrowLeft", dx: -1, dy: 0, dir: "left" },
      { key: "ArrowRight", dx: 1, dy: 0, dir: "right" },
    ];

    directions.forEach(({ key, dx, dy, dir }) => {
      if (keysRef.current[key]) {
        const newX = player.position.x + dx * player.speed;
        const newY = player.position.y + dy * player.speed;

        if (!checkCollision(newX, newY)) {
          player.position.x = newX;
          player.position.y = newY;
          player.setDirection(dir);
          player.moving = true;
          moved = true;
        }
      }
    });

    // Emit movement to server
    if (moved && socketRef.current) {
      socketRef.current.emit("playerMovement", {
        position: player.position,
        direction: player.lastDirection,
        moving: true,
      });
    }

    // Check for nearby players
    checkNearbyPlayers();

    // Draw game elements
    Object.values(otherPlayers).forEach((p) => {
      if (p instanceof Sprite) {
        p.draw(ctx);
      }
    });
    player.draw(ctx);
    interactionMenu.current.draw(ctx);

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [
    player,
    otherPlayers,
    ctx,
    checkCollision,
    checkNearbyPlayers,
    mapImage,
    backgroundImage,
    boundaries,
    interactionMenu,
  ]);

  useEffect(() => {
    if (player && mapImage) {
      animate();
    }
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [animate, player, mapImage]);

  // Add these handlers before the return statement
  const handleToggleMute = () => {
    if (videoCall.localStream) {
      videoCall.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  const handleToggleVideo = () => {
    if (videoCall.localStream) {
      videoCall.localStream.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
        setIsVideoOff(!track.enabled);
      });
    }
  };

  // Track if mouse is hovering over conference room
  const [hoverConferenceRoom, setHoverConferenceRoom] = useState(false);

  // Helper to check if a pixel position is in conference room (area with 2 in collisions)
  const isPixelInConferenceRoom = (x, y) => {
    const gridX = Math.floor(x / 32);
    const gridY = Math.floor(y / 32);
    return collisions[gridY]?.[gridX] === 2;
  };

  // Mouse move handler for conference room hover
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setHoverConferenceRoom(isPixelInConferenceRoom(mouseX, mouseY));
    };

    const handleMouseLeave = () => setHoverConferenceRoom(false);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
    };
  }, [canvasRef]);

  // Helper to check if player is in conference room (area with 2 in collisions)
  const isPlayerInConferenceRoom = (() => {
    if (!player) return false;
    const gridX = Math.floor(player.position.x / 32);
    const gridY = Math.floor(player.position.y / 32);
    return collisions[gridY]?.[gridX] === 2;
  })();

  return (
    <div className="game-container" ref={gameContainerRef}>
      {/* Conference Room Banner (show on hover or when inside) */}
      {(isPlayerInConferenceRoom || hoverConferenceRoom) && (
        <div
          style={{
            position: "fixed",
            top: 32,
            left: "50%",
            transform: "translateX(-50%)",
            background: "linear-gradient(90deg, #4a6cf7 0%, #43e97b 100%)",
            color: "#fff",
            padding: "16px 48px",
            borderRadius: "16px",
            fontSize: "22px",
            fontWeight: "bold",
            letterSpacing: "1.5px",
            zIndex: 5000,
            boxShadow: "0 4px 24px #4a6cf799, 0 0px 0px #0000",
            border: "2.5px solid #fff",
            textShadow: "0 2px 8px #2228",
            fontFamily: "'Press Start 2P', 'VT323', 'monospace', monospace",
            display: "flex",
            alignItems: "center",
            gap: 16,
            pointerEvents: "none",
            opacity: isPlayerInConferenceRoom ? 1 : 0.85,
          }}
        >
          <span role="img" aria-label="Conference" style={{ fontSize: 28 }}>🏢</span>
          Conference Room
        </div>
      )}
      {/* Name Input Modal */}
      {showNameModal && (
        <div className="name-modal-backdrop">
          <div className="name-modal">
            <h2 style={{ color: "black" }}>Enter Your Player Name</h2>
            <input
              type="text"
              placeholder="Enter your name"
              value={tempPlayerName}
              onChange={(e) => setTempPlayerName(e.target.value)}
              maxLength="15"
              onKeyDown={(e) => e.key === "Enter" && handleNameSubmit()}
            />
            <button onClick={handleNameSubmit}>Start Game</button>
          </div>
        </div>
      )}

      <div className="header-bar">
        <div className="game-logo">Virtual Office</div>
        <div className="player-controls">
          <div className="player-name-display">{playerName}</div>
          <div className="player-count">Players: {playerCount}</div>
        </div>
      </div>
      <div style={{ position: "relative" }}>
        <canvas ref={canvasRef} width={1550} height={700} />
        <button
          className="chat-button"
          onClick={() => setShowChat(!showChat)}
          style={{
            position: "absolute",
            bottom: "20px",
            right: "20px",
            backgroundColor: "#4CAF50",
            border: "none",
            borderRadius: "50%",
            width: "50px",
            height: "50px",
            cursor: "pointer",
            boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MessageCircle
            style={{
              width: "30px",
              height: "30px",
            }}
          />
        </button>
      </div>
      {/* Incoming Call Popup */}
      {incomingCall && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.35)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "linear-gradient(90deg, #23272e 0%, #3a3f4b 100%)",
              borderRadius: "18px",
              padding: "38px 48px 32px 48px",
              boxShadow: "0 8px 32px #000a, 0 0px 0px #0000",
              textAlign: "center",
              minWidth: "340px",
              border: "4px solid #4a6cf7",
              fontFamily: "'Press Start 2P', 'VT323', 'monospace', monospace",
              color: "#fff",
              letterSpacing: "1px",
              userSelect: "none",
              position: "relative",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, marginBottom: 18 }}>
              <span
                style={{
                  fontSize: 34,
                  filter: "drop-shadow(0 2px 0 #222)",
                  marginRight: 4,
                }}
                role="img"
                aria-label="Phone"
              >
                📞
              </span>
              <span
                style={{
                  fontWeight: "bold",
                  color: "#ffe066",
                  textShadow: "0 2px 0 #222, 0 0px 8px #ffe06699",
                  fontSize: 24,
                  letterSpacing: "2px",
                }}
              >
                Incoming Call
              </span>
            </div>
            <div style={{ marginBottom: 24, fontSize: 18, color: "#fff", textShadow: "0 1px 0 #222" }}>
              <span style={{ color: "#ffe066", fontWeight: "bold" }}>{incomingCall.callerName}</span> is calling you...
            </div>
            <div style={{ display: "flex", gap: 24, justifyContent: "center", marginTop: 10 }}>
              <button
                style={{
                  background: "linear-gradient(90deg, #4CAF50 0%, #43e97b 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 32px",
                  fontSize: 18,
                  fontFamily: "inherit",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #4CAF5044",
                  letterSpacing: "1px",
                  transition: "background 0.2s",
                  // outline: "3px solid #ffe066", // <-- removed yellow border
                }}
                onClick={handleAcceptCall}
              >
                Accept
              </button>
              <button
                style={{
                  background: "linear-gradient(90deg, #ff4b4b 0%, #ffb199 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  padding: "12px 32px",
                  fontSize: 18,
                  fontFamily: "inherit",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #ff4b4b44",
                  letterSpacing: "1px",
                  transition: "background 0.2s",
                  // outline: "3px solid #ffe066", // <-- removed yellow border
                }}
                onClick={() => setIncomingCall(null)}
              >
                Reject
              </button>
            </div>
            <div
              style={{
                marginTop: 18,
                fontSize: 13,
                color: "#aaa",
                letterSpacing: "0.5px",
                fontFamily: "inherit",
                textShadow: "0 1px 0 #222",
              }}
            >
              Socialize for XP!
            </div>
          </div>
        </div>
      )}
      {/* Video Call Modal */}
      {videoCall.active && (
        <div
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            zIndex: 3000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "linear-gradient(135deg, #f8fafc 0%, #e6e9f0 100%)",
              borderRadius: "20px",
              padding: "36px 38px 28px 38px",
              boxShadow: "0 8px 32px rgba(50,60,90,0.18), 0 0px 0px #0000",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              minWidth: 540,
              minHeight: 410,
              border: "1.5px solid #e0e6ff",
              fontFamily: "'Press Start 2P', 'VT323', 'monospace', monospace",
              color: "#23272e",
              letterSpacing: "1px",
              userSelect: "none",
              textAlign: "center",
              position: "relative",
            }}
          >
            <div style={{
              fontWeight: "bold",
              color: "#4a6cf7",
              textShadow: "0 2px 0 #e0e6ff, 0 0px 8px #4a6cf733",
              fontSize: 28,
              letterSpacing: "2px",
              marginBottom: 18,
              marginTop: 2,
              fontFamily: "'Press Start 2P', 'VT323', 'monospace', monospace"
            }}>
              Video Call
            </div>
            <div style={{
              display: "flex",
              gap: 36,
              margin: "0 0 14px 0",
              justifyContent: "center",
              alignItems: "center"
            }}>
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                style={{
                  width: 340,
                  height: 240,
                  borderRadius: 14,
                  background: "#222",
                  border: "2px solid #4a6cf7",
                  boxShadow: "0 2px 12px #4a6cf722",
                  objectFit: "cover",
                  transition: "border 0.2s"
                }}
              />
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                style={{
                  width: 340,
                  height: 240,
                  borderRadius: 14,
                  background: "#222",
                  border: "2px solid #4a6cf7",
                  boxShadow: "0 2px 12px #4a6cf722",
                  objectFit: "cover",
                  transition: "border 0.2s"
                }}
              />
            </div>
            {/* Mute/Unmute and Video On/Off Controls */}
            <div style={{
              display: "flex",
              gap: 24,
              margin: "14px 0 0 0",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <button
                onClick={handleToggleMute}
                style={{
                  background: isMuted
                    ? "linear-gradient(90deg, #ffb199 0%, #ff4b4b 100%)"
                    : "linear-gradient(90deg, #4CAF50 0%, #43e97b 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #4a6cf744",
                  fontSize: 22,
                  transition: "background 0.2s",
                }}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? <MicOff size={28} /> : <Mic size={28} />}
              </button>
              <button
                onClick={handleToggleVideo}
                style={{
                  background: isVideoOff
                    ? "linear-gradient(90deg, #ffb199 0%, #ff4b4b 100%)"
                    : "linear-gradient(90deg, #4a6cf7 0%, #43e97b 100%)",
                  color: "#fff",
                  border: "none",
                  borderRadius: "50%",
                  width: 48,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #4a6cf744",
                  fontSize: 22,
                  transition: "background 0.2s",
                }}
                title={isVideoOff ? "Turn Video On" : "Turn Video Off"}
              >
                {isVideoOff ? <VideoOff size={28} /> : <Video size={28} />}
              </button>
              <button
                style={{
                  background: "linear-gradient(90deg, #ff4b4b 0%, #ffb199 100%)",
                  color: "white",
                  border: "none",
                  borderRadius: "10px",
                  padding: "13px 34px",
                  fontSize: 18,
                  fontFamily: "inherit",
                  fontWeight: "bold",
                  cursor: "pointer",
                  boxShadow: "0 2px 8px #ff4b4b44",
                  letterSpacing: "1px",
                  marginLeft: 16,
                  outline: "none",
                  transition: "background 0.2s",
                }}
                onClick={handleEndCall}
              >
                End Call
              </button>
            </div>
            <div
              style={{
                marginTop: 14,
                fontSize: 13,
                color: "#4a6cf7",
                letterSpacing: "0.5px",
                fontFamily: "inherit",
                textShadow: "0 1px 0 #fff",
                fontWeight: "bold"
              }}
            >
              Socialize for XP!
            </div>
          </div>
        </div>
      )}
      {/* Meeting Room Video Conference */}
      {meetingRoomCall.active && (
        <div
          style={{
            position: "fixed",
            right: "20px",
            top: "20px",
            width: "340px",
            backgroundColor: "rgba(0, 0, 0, 0.88)",
            borderRadius: "12px",
            padding: "16px 12px 12px 12px",
            zIndex: 1000,
            boxShadow: "0 4px 24px #000a",
          }}
        >
          <h3 style={{ color: "white", margin: "0 0 10px 0", fontSize: 20, letterSpacing: 1 }}>Meeting Room</h3>
          {/* Local video */}
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <video
              autoPlay
              muted
              playsInline
              style={{
                width: "100%",
                borderRadius: "7px",
                marginBottom: "2px",
                background: "#222",
                border: "2px solid #4a6cf7",
                objectFit: "cover",
              }}
              ref={(el) => {
                if (el && meetingRoomCall.localStream) {
                  el.srcObject = meetingRoomCall.localStream;
                }
              }}
            />
            <div
              style={{
                position: "absolute",
                left: 8,
                bottom: 8,
                background: "rgba(0,0,0,0.7)",
                color: "#fff",
                borderRadius: 6,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 8,
                pointerEvents: "auto",
              }}
            >
              {meetingNameMap[socketRef.current?.id] || playerName || "You"}
            </div>
          </div>
          {/* Remote videos */}
          {meetingRoomCall.remoteStreams &&
            Object.entries(meetingRoomCall.remoteStreams).map(
              ([userId, stream]) => (
                <div key={userId + (stream ? stream.id : "")} style={{ position: "relative", marginBottom: "12px" }}>
                  <video
                    autoPlay
                    playsInline
                    style={{
                      width: "100%",
                      borderRadius: "7px",
                      marginBottom: "2px",
                      background: "#222",
                      border: "2px solid #4a6cf7",
                      objectFit: "cover",
                    }}
                    ref={(el) => {
                      if (el && stream) {
                        el.srcObject = stream;
                        el.muted = false;
                      }
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: 8,
                      bottom: 8,
                      background: "rgba(0,0,0,0.7)",
                      color: "#fff",
                      borderRadius: 6,
                      padding: "2px 10px",
                      fontSize: 13,
                      fontWeight: "bold",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      pointerEvents: "auto",
                    }}
                  >
                    {/* Show actual player name if available */}
                    {meetingNameMap[userId] || otherPlayers[userId]?.name || `User ${userId.slice(-4)}`}
                  </div>
                </div>
              )
            )}
        </div>
      )}
      {showChat && (
        <div
          style={{
            position: "fixed",
            right: "20px",
            bottom: "80px",
            width: "800px",
            height: "70vh",
            backgroundColor: "white",
            borderRadius: "15px",
            boxShadow:
              "0 10px 25px rgba(0,0,0,0.3), 0 6px 12px rgba(74, 108, 247, 0.2)",
            zIndex: 1000,
            overflow: "hidden",
            border: "2px solid rgba(74, 108, 247, 0.1)",
            background: "linear-gradient(to bottom right, #ffffff, #f0f4ff)",
          }}
        >
          <button
            onClick={() => setShowChat(false)}
            style={{
              position: "absolute",
              right: "10px",
              top: "10px",
              backgroundColor: "#ff4b4b",
              border: "none",
              borderRadius: "50%",
              width: "30px",
              height: "30px",
              color: "white",
              fontSize: "18px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
              zIndex: 1001,
            }}
          >
            ×
          </button>
          <Chat username={playerName} socket={socketRef.current} />
        </div>
      )}
      {/* Gamified Toast message for call end */}
      {toast && (
        <div
          style={{
            position: "fixed",
            left: "50%",
            bottom: "40px",
            transform: "translateX(-50%)",
            background: "linear-gradient(90deg, #23272e 0%, #3a3f4b 100%)",
            color: "#fff",
            padding: "18px 38px 22px 38px",
            borderRadius: "18px",
            fontSize: "20px",
            zIndex: 4000,
            boxShadow: "0 4px 24px #000a, 0 0px 0px #0000",
            border: "4px solid #4a6cf7",
            fontFamily: "'Press Start 2P', 'VT323', 'monospace', monospace",
            minWidth: "320px",
            textAlign: "center",
            letterSpacing: "1px",
            userSelect: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
            <span
              style={{
                fontSize: 28,
                filter: "drop-shadow(0 2px 0 #222)",
                marginRight: 4,
              }}
              role="img"
              aria-label="Trophy"
            >
              🏆
            </span>
            <span
              style={{
                fontWeight: "bold",
                color: "#ffe066",
                textShadow: "0 2px 0 #222, 0 0px 8px #ffe06699",
                fontSize: 22,
                letterSpacing: "2px",
              }}
            >
              {toast}
            </span>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 12,
              color: "#aaa",
              letterSpacing: "0.5px",
              fontFamily: "inherit",
              textShadow: "0 1px 0 #222",
            }}
          >
            +10 XP for socializing!
          </div>
        </div>
      )}
    </div>
  );
};

export default Canvas;