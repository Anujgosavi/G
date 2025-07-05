export default class InteractionMenu {
    constructor() {
        this.visible = false;
        this.targetId = null;
        this.position = { x: 0, y: 0 };
        this.selectedOption = null;
    }
    
    show(targetId, position) {
        this.visible = true;
        this.targetId = targetId;
        this.position = position;
        this.selectedOption = null;
    }
    
    hide() {
        this.visible = false;
        this.targetId = null;
        this.selectedOption = null;
    }
    
    draw(ctx) {
        if (!this.visible || !ctx) return;
        
        const menuWidth = 90;
        const menuHeight = 60;
        const menuX = this.position.x - menuWidth / 2;
        const menuY = this.position.y - menuHeight - 15;
        
        // Draw menu background
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.roundRect(menuX, menuY, menuWidth, menuHeight, 8);
        ctx.fill();
        
        // Draw menu border
        ctx.strokeStyle = "#4286f4";
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw menu options
        ctx.font = "bold 14px Arial";
        ctx.textAlign = "center";
        
        // Chat option
        const chatY = menuY + 22;
        if (this.selectedOption === 'chat') {
            ctx.fillStyle = "#4286f4";
            ctx.fillRect(menuX + 5, chatY - 14, menuWidth - 10, 18);
            ctx.fillStyle = "#ffffff";
        } else {
            ctx.fillStyle = "#333333";
        }
        ctx.fillText("Chat", menuX + menuWidth / 2, chatY);
        
        // Voice Chat option
        const voiceChatY = menuY + 45;
        if (this.selectedOption === 'voiceChat') {
            ctx.fillStyle = "#4286f4";
            ctx.fillRect(menuX + 5, voiceChatY - 14, menuWidth - 10, 18);
            ctx.fillStyle = "#ffffff";
        } else {
            ctx.fillStyle = "#333333";
        }
        ctx.fillText("Voice Chat", menuX + menuWidth / 2, voiceChatY);
        
        // Draw pointer
        const pointerX = menuX + menuWidth / 2;
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.beginPath();
        ctx.moveTo(pointerX - 8, menuY + menuHeight);
        ctx.lineTo(pointerX + 8, menuY + menuHeight);
        ctx.lineTo(pointerX, menuY + menuHeight + 8);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#4286f4";
        ctx.stroke();
    }
    
    handleMouseMove(x, y) {
        if (!this.visible) return false;
        
        const menuWidth = 90;
        const menuHeight = 60;
        const menuX = this.position.x - menuWidth / 2;
        const menuY = this.position.y - menuHeight - 15;
        
        // Check if mouse is over chat option
        if (x >= menuX + 5 && x <= menuX + menuWidth - 5 &&
            y >= menuY + 8 && y <= menuY + 26) {
            this.selectedOption = 'chat';
            return true;
        }
        
        // Check if mouse is over voice chat option
        if (x >= menuX + 5 && x <= menuX + menuWidth - 5 &&
            y >= menuY + 31 && y <= menuY + 49) {
            this.selectedOption = 'voiceChat';
            return true;
        }
        
        this.selectedOption = null;
        return false;
    }
    
    handleClick(otherPlayers) {
        if (!this.visible || !this.selectedOption) return false;
        
        if (this.selectedOption === 'chat') {
            console.log("Chat option selected with player: " + this.targetId);
            if (otherPlayers[this.targetId]) {
                otherPlayers[this.targetId].showDialogue("Chat option selected");
            }
        } else if (this.selectedOption === 'voiceChat') {
            console.log("Voice Chat option selected with player: " + this.targetId);
            if (otherPlayers[this.targetId]) {
                otherPlayers[this.targetId].showDialogue("Voice Chat option selected");
            }
        }
        
        this.hide();
        return true;
    }
}