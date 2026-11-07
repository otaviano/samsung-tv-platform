import { describe, expect, it } from 'vitest';
import { formatClock } from './StatusBar';

describe('formatClock', () => {
  it('pt-BR com zero à esquerda', () => {
    expect(formatClock(new Date(2026, 10, 7, 9, 5))).toEqual({ time: '09:05', date: 'sábado, 7 de novembro' });
  });
});
