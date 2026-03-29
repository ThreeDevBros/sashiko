// Notification sound utility using Web Audio API
// Web Audio API is more reliable than HTMLAudioElement for programmatic playback

let audioContext: AudioContext | null = null;
let isUnlocked = false;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioContext;
};

// Unlock audio context on first user interaction (required by browsers)
const unlock = () => {
  if (isUnlocked) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    // Play a silent buffer to unlock
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    isUnlocked = true;
    console.log('🔊 Audio context unlocked');
  } catch (e) {
    console.log('Audio unlock failed:', e);
  }
};

// Register unlock on common user interactions
if (typeof window !== 'undefined') {
  const events = ['click', 'touchstart', 'keydown'];
  const unlockHandler = () => {
    unlock();
    events.forEach(e => document.removeEventListener(e, unlockHandler));
  };
  events.forEach(e => document.addEventListener(e, unlockHandler, { once: false }));
}

// Generate a beep tone using Web Audio API oscillator
const playBeep = (frequency: number = 880, duration: number = 150, volume: number = 0.5) => {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
  } catch (e) {
    console.log('Beep failed:', e);
  }
};

// Play order notification: 3 ascending beeps
export const playOrderAlert = () => {
  playBeep(660, 200, 0.6);
  setTimeout(() => playBeep(880, 200, 0.6), 250);
  setTimeout(() => playBeep(1100, 300, 0.7), 500);
};

// Play reservation notification: 2 softer beeps  
export const playReservationAlert = () => {
  playBeep(520, 200, 0.5);
  setTimeout(() => playBeep(780, 250, 0.5), 300);
};
