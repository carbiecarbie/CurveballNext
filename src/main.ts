import './styles.css';
import { mountOnline } from './multiplayer/ui';
const classic = document.querySelector('main')!;
classic.id = 'classic'; classic.hidden = true;
const menu = document.createElement('main');
menu.innerHTML = '<header><strong class="wordmark">CURVEBALL<span>NEXT</span></strong></header><section class="mode-menu"><h1>Choose your game</h1><button id="classic-entry">Classic</button><button id="online-entry">Online · Private 1×1</button><p>Online is two friends, three lives each. No accounts or rejoining after interruption.</p></section>';
document.body.prepend(menu);
const online = document.createElement('main'); online.hidden = true; document.body.append(online);
let mounted = false;
document.querySelector('#classic-entry')!.addEventListener('click', () => {
  menu.hidden = true; classic.hidden = false; void import('./classic');
});
document.querySelector('#online-entry')!.addEventListener('click', () => {
  menu.hidden = true; online.hidden = false;
  if (!mounted) { mounted = true; mountOnline(online, () => { online.hidden = true; menu.hidden = false; }); }
});
if (location.hash.startsWith('#room=')) (document.querySelector('#online-entry') as HTMLButtonElement).click();
