import React, { useEffect } from 'react';

const Particles = () => {
  useEffect(() => {
    // Original particle animation logic from index.html
    const particlesContainer = document.getElementById('particles');
    const colors = ['#4a6cf7', '#f97b7b', '#02cd82'];
    
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      // ... rest of particle creation logic
      particlesContainer.appendChild(particle);
    }
  }, []);

  return <div id="particles" />;
};

export default Particles;