
# 🚀 Project Setup Guide

Follow these steps to set up and run the project locally.

---

## 📥 1. Download and Extract the ZIP File
- Download the project ZIP file.
- Extract the contents to your desired location.

---

## 🖥️ 2. Open the Project in Visual Studio Code
- Launch **Visual Studio Code**.
- Go to **File → Open Folder** and select the extracted project folder.

---

## 💻 3. Open the Integrated Terminal
- Press `` Ctrl + ` `` (backtick) to open the terminal in VS Code.
- Navigate to the project directory (if not already there):
  ```bash
  cd path/to/project
  ```

---

## 🌐 4. Set Up and Run the Frontend
In the terminal, run the following commands:
```bash
cd frontend
npm install
npm run start
```
- This will install the necessary dependencies and start the frontend server.

---

## 🗄️ 5. Run the Backend
- Open another terminal tab in VS Code (or press `` Ctrl + ` `` again).
- Navigate to the project directory:
  ```bash
  cd path/to/project
  ```
- Run the backend server:
  ```bash
  cd backend
  npm install
  node server.js
  ```

---

## ✅ 6. You're All Set!
- **Frontend:** Runs on `http://localhost:3000` (or the specified port).  
- **Backend:** Runs on `http://localhost:30001` (or the specified port).

---

### 🔗 Additional Notes
- Make sure you have **Node.js** and **npm** installed on your system.  
- If you encounter issues, try clearing the npm cache:
  ```bash
  npm cache clean --force
  ```

---
