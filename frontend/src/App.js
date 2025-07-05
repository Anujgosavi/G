import React from 'react';
import Canvas from './components/Game/Canvas';
import Particles from './components/Particles';
import './App.css';

function App() {
  return (
    <div className="App">
      <Particles />
      <div id="gameWrapper">
        <Canvas />
      </div>
    </div>
  );
}

export default App;