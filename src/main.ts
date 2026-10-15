import './styles.css';
import './landing.css';
const classic = document.querySelector<HTMLElement>('#classic')!;
const menu = document.querySelector<HTMLElement>('#landing')!;
// The hero clip is decoration: respect a reduced-motion preference by leaving it on its poster frame.
const clip = document.querySelector<HTMLVideoElement>('#lp-video');
if (clip && matchMedia('(prefers-reduced-motion: reduce)').matches) { clip.removeAttribute('autoplay'); clip.pause(); }
document.querySelector('#classic-entry')!.addEventListener('click', () => {
  menu.hidden = true; classic.hidden = false; window.scrollTo(0, 0); void import('./classic');
});
