// Barra superior: relógio, data e rede. Formatação manual em pt-BR: o ICU do runtime do
// device não foi medido (toLocale* pode cair em inglês).
import { useEffect, useState } from 'preact/hooks';
import { readNetwork, type NetStatus } from '../platform/network';
import { WifiBars } from './icons';

const DAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const pad = (n: number) => (n < 10 ? '0' : '') + n;

export function formatClock(d: Date): { time: string; date: string } {
  return {
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    date: `${DAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`,
  };
}

function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let interval: number | undefined;
    // Alinha ao minuto; depois, a cada 60 s.
    const t = window.setTimeout(() => {
      setNow(new Date());
      interval = window.setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000) + 50);
    return () => {
      clearTimeout(t);
      if (interval) clearInterval(interval);
    };
  }, []);
  return now;
}

function useNetwork(): NetStatus {
  const [net, setNet] = useState(readNetwork);
  useEffect(() => {
    const refresh = () => setNet(readNetwork());
    const id = window.setInterval(refresh, 15_000);
    window.addEventListener('online', refresh);
    window.addEventListener('offline', refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', refresh);
      window.removeEventListener('offline', refresh);
    };
  }, []);
  return net;
}

export function StatusBar() {
  const { time, date } = formatClock(useNow());
  const net = useNetwork();
  const label =
    net.kind === 'none' ? 'Sem rede' : net.kind === 'ethernet' ? 'Cabo' : net.ssid || 'Wi-Fi';
  return (
    <header class="status">
      <div class="status__clock">
        <span class="status__time">{time}</span>
        <span class="status__date">{date}</span>
      </div>
      <div class={'status__net' + (net.online ? '' : ' is-offline')}>
        {net.kind === 'wifi' ? <WifiBars level={net.level} /> : null}
        <span class="status__ssid">{label}</span>
        {net.kind !== 'none' && !net.online ? <span class="status__warn">sem internet</span> : null}
      </div>
    </header>
  );
}
