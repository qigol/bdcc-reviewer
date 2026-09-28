import { plainText } from '@kodigo/schema';

export function speak(md: string, enabled: boolean) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(plainText(md));
  u.rate = 1.02;
  window.speechSynthesis.speak(u);
}
export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
}
