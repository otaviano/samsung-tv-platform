// Detecção de power-on (E9, docs/runbooks/e8-background-boot.md).
// No standby o Tizen CONGELA o processo (não encerra; testado até 9 h 16 min). Um tique
// periódico vê, no primeiro disparo após ligar, um intervalo real muito maior que o
// período. É o sinal primário: o evento `online` não disparou no standby longo.

export class WakeDetector {
  private last: number;

  constructor(now: number, private readonly gapMs = 10_000) {
    this.last = now;
  }

  /** Chamar a cada tique. Devolve o intervalo (ms) se o processo esteve congelado. */
  tick(now: number): number | null {
    const gap = now - this.last;
    this.last = now;
    return gap > this.gapMs ? gap : null;
  }
}
