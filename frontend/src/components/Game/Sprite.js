class Sprite {
  constructor({
    position,
    image,
    frames = { max: 1 },
    sprites = {},
    name = "",
    id = null,
    speed = 3,
    lastDirection = "down",
    moving = false,
    characterIndex = 0,
  }) {
    this.position = position;
    this.image = image;
    this.frames = { ...frames, val: 0, elapsed: 0 };
    this.sprites = sprites;
    this.name = name || "";
    this.id = id;
    this.speed = speed || 2;
    this.lastDirection = lastDirection;
    this.moving = moving;
    this.prevMoving = moving; // Track previous moving state
    this.characterIndex = characterIndex;
    this.width = 15;
    this.height = 15;
    this.distanceToPlayer = null;
    this.showInteractionMenu = false;
    this.interactingWith = null;
    this.dialogue = null;
    this.dialogueTimer = 0;
  }

  setDirection(direction) {
    this.lastDirection = direction;
    this.moving = true;
  }

  updatePosition(newPosition) {
    this.position = { ...newPosition };
  }

  updateMovementState({ direction, moving }) {
    this.lastDirection = direction || this.lastDirection;
    this.moving = moving !== undefined ? moving : this.moving;
  }

  draw(ctx) {
    if (!this.image || !(this.image instanceof HTMLImageElement)) {
      console.warn(
        `Cannot draw sprite for ${this.name || this.id}: Invalid image`
      );
      return;
    }

    // Multiplayer logic: support 4-row character sprite sheets
    const frameWidth = this.image.width / 3;
    const frameHeight = this.image.height / 4;

    let row = 0;
    switch (this.lastDirection) {
      case "down":
        row = 0;
        break;
      case "left":
        row = 1;
        break;
      case "right":
        row = 2;
        break;
      case "up":
        row = 3;
        break;
      default:
        row = 0;
    }

    if (this.moving) {
      this.frames.elapsed++;
      if (this.frames.elapsed % 10 === 0) {
        this.frames.val = (this.frames.val + 1) % this.frames.max;
      }
    } else if (this.prevMoving) {
      this.frames.val = 0;
    }
    this.prevMoving = this.moving;

    const cropX = this.frames.val * frameWidth;
    const cropY = row * frameHeight;

    ctx.drawImage(
      this.image,
      cropX,
      cropY,
      frameWidth,
      frameHeight,
      this.position.x,
      this.position.y,
      frameWidth,
      frameHeight
    );

    if (this.name) {
      ctx.fillStyle = "black";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        this.name,
        this.position.x + frameWidth / 2,
        this.position.y + 10
      );
    }

    if (this.distanceToPlayer !== null) {
      ctx.fillStyle = "red";
      ctx.font = "10px Arial";
      ctx.textAlign = "center";
      ctx.fillText(
        `${this.distanceToPlayer.toFixed(1)} px`,
        this.position.x + frameWidth / 2,
        this.position.y - 18
      );
    }

    if (this.dialogue) this.drawDialogue(ctx);
  }

  drawDialogue(ctx) {
    if (this.dialogueTimer && Date.now() > this.dialogueTimer) {
      this.dialogue = null;
      this.dialogueTimer = 0;
      return;
    }

    const maxWidth = 150;
    const lineHeight = 15;
    const lines = this.wrapText(this.dialogue, maxWidth - 10);

    const bubbleHeight = lineHeight * lines.length + 15;
    const bubbleWidth = maxWidth;
    const bubbleX = this.position.x - bubbleWidth / 2 + this.width / 2;
    const bubbleY = this.position.y - bubbleHeight - 25;

    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    this.drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);

    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.stroke();

    const pointerX = bubbleX + bubbleWidth / 2;
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.beginPath();
    ctx.moveTo(pointerX - 8, bubbleY + bubbleHeight);
    ctx.lineTo(pointerX + 8, bubbleY + bubbleHeight);
    ctx.lineTo(pointerX, bubbleY + bubbleHeight + 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#333";
    ctx.font = "12px Arial";
    ctx.textAlign = "left";

    lines.forEach((line, i) => {
      ctx.fillText(line, bubbleX + 8, bubbleY + 15 + i * lineHeight);
    });
  }

  wrapText(text, maxWidth) {
    if (!text) return [];

    const words = text.split(" ");
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const width = this.measureText(currentLine + " " + word).width;

      if (width < maxWidth) {
        currentLine += " " + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }

    lines.push(currentLine);
    return lines;
  }

  drawRoundedRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  showDialogue(text, duration = 4000) {
    this.dialogue = text;
    this.dialogueTimer = Date.now() + duration;
  }
}

export default Sprite;
