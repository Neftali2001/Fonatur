"use client";
import React, { useEffect, useRef, useState } from "react";

const BackgroundMusic: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    const audio = new Audio("/music.mp3"); // archivo en /public
    audio.loop = true;
    audio.volume = 0.5;

    audioRef.current = audio;

    const playAudio = async () => {
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        console.log("Autoplay bloqueado:", error);
      }
    };

    playAudio();

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }

    setIsPlaying(!isPlaying);
  };

  return (
    <button
      onClick={togglePlay}
      style={{ position: "fixed", bottom: 10, right: 10 }}
    >
      {isPlaying ? "Pause 🔇" : "Play 🎵"}
    </button>
  );
};

export default BackgroundMusic;