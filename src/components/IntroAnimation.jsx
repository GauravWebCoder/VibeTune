import { useState, useEffect } from 'react';
import './IntroAnimation.css';

const IntroAnimation = ({ onComplete }) => {
  const [showIntro, setShowIntro] = useState(true);
  const [showVibeTune, setShowVibeTune] = useState(false);
  const [showCreator, setShowCreator] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Animation sequence - shows every time
    const timer1 = setTimeout(() => {
      setShowVibeTune(true);
    }, 500);

    const timer2 = setTimeout(() => {
      setShowCreator(true);
    }, 1200);

    const timer3 = setTimeout(() => {
      setFadeOut(true);
    }, 3500);

    const timer4 = setTimeout(() => {
      setShowIntro(false);
      onComplete();
    }, 4500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, [onComplete]);

  if (!showIntro) return null;

  return (
    <div className={`intro-container ${fadeOut ? 'fade-out' : ''}`}>
      <div className="intro-background">
        <div className="glow-animation"></div>
      </div>
      
      <div className="intro-content">
        <div className={`vibetune-text ${showVibeTune ? 'show' : ''}`}>
          <img src="/VibeTune WBG.png" alt="VibeTune Logo" className="intro-logo" />
          <h1 className="intro-title">VibeTune</h1>
        </div>
        
        <div className={`creator-text ${showCreator ? 'show' : ''}`}>
          <p>by Gaurav Mathpal</p>
        </div>
      </div>
    </div>
  );
};

export default IntroAnimation;
