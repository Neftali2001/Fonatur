"use client";
import React, { useRef, useState, useEffect } from "react";

const BackgroundMusic: React.FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Iniciamos en false para evitar desfases en la UI
  const [isPlaying, setIsPlaying] = useState(false); 

useEffect(() => {
  const handleInteraction = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.play()
        .then(() => {
          setIsPlaying(true);
          // ⚠️ Aquí es donde debemos dejar de escuchar el evento
        })
        .catch(err => console.log("Aún bloqueado"));
    }
  };

  // Agregamos los escuchadores a la ventana global
  window.addEventListener("mousemove", handleInteraction);
  window.addEventListener("scroll", handleInteraction);

  return () => {
    // Limpieza al desmontar el componente
    window.removeEventListener("mousemove", handleInteraction);
    window.removeEventListener("scroll", handleInteraction);
  };
}, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (audio.paused) {
      audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  };

  return (
    <>
      {/* Quitamos el atributo autoPlay del HTML ya que lo manejamos en useEffect */}
      <audio
        ref={audioRef}
        src="/music.mp3"
        loop
        preload="auto"
      />

      <button
        onClick={togglePlay}
        style={{
          position: "fixed",
          bottom: 10,
          right: 10,
          background: "#2563eb",
          color: "white",
          padding: "10px 15px",
          borderRadius: "50px",
          border: "none",
          cursor: "pointer",
          zIndex: 9999, // Asegura que el botón siempre sea visible
        }}
      >
        {isPlaying ? "Pause 🔇" : "Play 🎵"}
      </button>
    </>
  );
};

export default BackgroundMusic;

// "use client";
// import React, { useEffect, useRef, useState } from "react";

// const BackgroundMusic: React.FC = () => {
//   const audioRef = useRef<HTMLAudioElement | null>(null);
//   const [isPlaying, setIsPlaying] = useState(false);

//   useEffect(() => {
//     const audio = new Audio("/music.mp3"); // archivo en /public
//     audio.loop = true;
//     audio.volume = 0.5;

//     audioRef.current = audio;

//     const playAudio = async () => {
//       try {
//         await audio.play();
//         setIsPlaying(true);
//       } catch (error) {
//         console.log("Autoplay bloqueado:", error);
//       }
//     };

//     playAudio();

//     return () => {
//       audio.pause();
//       audio.currentTime = 0;
//     };
//   }, []);

//   const togglePlay = () => {
//     if (!audioRef.current) return;

//     if (isPlaying) {
//       audioRef.current.pause();
//     } else {
//       audioRef.current.play();
//     }

//     setIsPlaying(!isPlaying);
//   };

//   return (
//     <button
//       onClick={togglePlay}
//       style={{ position: "fixed", bottom: 10, right: 10 }}
//     >
//       {isPlaying ? "Pause 🔇" : "Play 🎵"}
//     </button>
//   );
// };

// export default BackgroundMusic;