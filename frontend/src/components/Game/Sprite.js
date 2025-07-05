export default class Sprite {
    constructor({ position, image, frames = { max: 1 }, sprites = {}, name = "", id = null, speed = 3 }) {
      this.position = position;
      this.image = image;
      this.frames = frames;
      this.sprites = sprites;
      this.name = name;
      this.id = id;
      this.width = 40;
      this.height = 40;
      this.speed = speed;
      this.frameIndex = 0;
      this.frameCount = 0;
      this.moving = false;
      this.lastDirection = "down";
      this.showInteractionMenu = false;
      this.interactingWith = null;
      this.dialogue = null;
      this.dialogueTimer = 0;
    }
  
    setDirection(direction) {
      if (this.lastDirection !== direction && this.sprites[direction]) {
        this.image = this.sprites[direction];
        this.lastDirection = direction;
      }
    }
  
    draw(ctx) {
      const frameWidth = this.image.width / this.frames.max;
      ctx.drawImage(
        this.image,
        this.frameIndex * frameWidth, 0, frameWidth, this.image.height,
        this.position.x, this.position.y, this.width, this.height
      );
  
      // Animate frames only when moving
      if (this.moving && ++this.frameCount % 10 === 0) {
        this.frameIndex = (this.frameIndex + 1) % this.frames.max;
      } else if (!this.moving) {
        this.frameIndex = 0;
      }
  
      if (this.name) this.drawNameTag(ctx);
      if (this.dialogue) this.drawDialogue(ctx);
    }
  
    drawNameTag(ctx) {
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
  
      const textWidth = ctx.measureText(this.name).width;
      const padding = 4;
      const bgX = this.position.x + this.width / 2 - textWidth / 2 - padding;
      const bgY = this.position.y - 20;
      const bgWidth = textWidth + padding * 2;
      const bgHeight = 18;
  
      // Background for the name tag
      ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
      ctx.fillRect(bgX, bgY, bgWidth, bgHeight);
  
      // Name text
      ctx.fillStyle = "white";
      ctx.fillText(this.name, this.position.x + this.width / 2, this.position.y - 8);
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
      
      // Draw speech bubble background
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      this.drawRoundedRect(ctx, bubbleX, bubbleY, bubbleWidth, bubbleHeight, 8);
      
      // Draw bubble border
      ctx.strokeStyle = "#333";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw pointer
      const pointerX = bubbleX + bubbleWidth / 2;
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.beginPath();
      ctx.moveTo(pointerX - 8, bubbleY + bubbleHeight);
      ctx.lineTo(pointerX + 8, bubbleY + bubbleHeight);
      ctx.lineTo(pointerX, bubbleY + bubbleHeight + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      // Draw text
      ctx.fillStyle = "#333";
      ctx.font = "12px Arial";
      ctx.textAlign = "left";
      
      lines.forEach((line, i) => {
        ctx.fillText(line, bubbleX + 8, bubbleY + 15 + (i * lineHeight));
      });
    }
    
    wrapText(text, maxWidth) {
      if (!text) return [];
      
      const words = text.split(' ');
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