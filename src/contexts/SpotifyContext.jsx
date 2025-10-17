import React, { createContext, useContext, useState, useCallback } from 'react';

export const SpotifyContext = createContext();

export const SpotifyProvider = ({ children }) => {
  const [isSpotifyReady, setIsSpotifyReady] = useState(false);
  const [isSpotifyPlaying, setIsSpotifyPlaying] = useState(false);
  const [spotifyCurrentTrack, setSpotifyCurrentTrack] = useState(null);
  const [spotifyPosition, setSpotifyPosition] = useState(0);
  const [spotifyDuration, setSpotifyDuration] = useState(0);

  const playSpotifyTrack = useCallback((track) => {
    // Placeholder for Spotify track playback
    console.log('Playing Spotify track:', track);
  }, []);

  const pauseSpotify = useCallback(() => {
    setIsSpotifyPlaying(false);
  }, []);

  const resumeSpotify = useCallback(() => {
    setIsSpotifyPlaying(true);
  }, []);

  const value = {
    isSpotifyReady,
    isSpotifyPlaying,
    spotifyCurrentTrack,
    spotifyPosition,
    spotifyDuration,
    playSpotifyTrack,
    pauseSpotify,
    resumeSpotify
  };

  return (
    <SpotifyContext.Provider value={value}>
      {children}
    </SpotifyContext.Provider>
  );
};

export const useSpotify = () => {
  const context = useContext(SpotifyContext);
  if (!context) {
    throw new Error('useSpotify must be used within a SpotifyProvider');
  }
  return context;
};
