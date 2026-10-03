import './styles.css';
import './landing.css';
import { mountOnline } from './multiplayer/ui';
const classic = document.querySelector<HTMLElement>('#classic')!;
const menu = document.querySelector<HTMLElement>('#landing')!;
const online = document.createElement('main'); online.hidden = true; document.body.append(online);
// The hero clip is decoration: respect a reduced-motion preference by leaving it on its poster frame.
const clip = document.querySelector<HTMLVideoElement>('#lp-video');
if (clip && matchMedia('(prefers-reduced-motion: reduce)').matches) { clip.removeAttribute('autoplay'); clip.pause(); }
let mounted = false;
document.querySelector('#classic-entry')!.addEventListener('click', () => {
  menu.hidden = true; classic.hidden = false; window.scrollTo(0, 0); void import('./classic');
});
document.querySelector('#online-entry')!.addEventListener('click', () => {
  menu.hidden = true; online.hidden = false; window.scrollTo(0, 0);
  if (!mounted) { mounted = true; mountOnline(online, () => { online.hidden = true; menu.hidden = false; }); }
});
if (location.hash.startsWith('#room=')) (document.querySelector('#online-entry') as HTMLButtonElement).click();
