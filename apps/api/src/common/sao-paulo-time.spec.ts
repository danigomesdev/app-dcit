import {
  dateOnlyInSaoPaulo,
  dayOfWeekFromDateOnly,
  formatDateOnlyBR,
  isWeekend,
  minutesSinceMidnight,
  nowSaoPauloTimeOnly,
  todaySaoPauloDateOnly,
} from './sao-paulo-time';

describe('sao-paulo-time', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  describe('todaySaoPauloDateOnly / dateOnlyInSaoPaulo', () => {
    it('stays on the previous calendar day when UTC has already rolled over but São Paulo has not', () => {
      // 2026-08-29T00:30:00.000Z is 2026-08-28T21:30:00 in São Paulo (UTC-3).
      jest.useFakeTimers().setSystemTime(new Date('2026-08-29T00:30:00.000Z'));
      expect(todaySaoPauloDateOnly()).toBe('2026-08-28');
    });

    it('matches the UTC date well within the day', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-28T15:00:00.000Z'));
      expect(todaySaoPauloDateOnly()).toBe('2026-08-28');
    });

    it('dateOnlyInSaoPaulo converts an arbitrary given date, not just "now"', () => {
      expect(dateOnlyInSaoPaulo(new Date('2026-09-01T01:00:00.000Z'))).toBe(
        '2026-08-31',
      );
    });
  });

  describe('nowSaoPauloTimeOnly', () => {
    it('returns the wall-clock HH:mm in São Paulo, 3 hours behind UTC', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-08-28T12:15:00.000Z'));
      expect(nowSaoPauloTimeOnly()).toBe('09:15');
    });
  });

  describe('dayOfWeekFromDateOnly / isWeekend', () => {
    it('identifies a Saturday as day 6 and a weekend', () => {
      expect(dayOfWeekFromDateOnly('2026-08-29')).toBe(6);
      expect(isWeekend('2026-08-29')).toBe(true);
    });

    it('identifies a Sunday as day 0 and a weekend', () => {
      expect(dayOfWeekFromDateOnly('2026-08-30')).toBe(0);
      expect(isWeekend('2026-08-30')).toBe(true);
    });

    it('identifies a Thursday as not a weekend', () => {
      expect(dayOfWeekFromDateOnly('2026-08-27')).toBe(4);
      expect(isWeekend('2026-08-27')).toBe(false);
    });
  });

  describe('minutesSinceMidnight', () => {
    it('converts HH:mm to minutes since midnight', () => {
      expect(minutesSinceMidnight('09:00')).toBe(540);
      expect(minutesSinceMidnight('00:00')).toBe(0);
      expect(minutesSinceMidnight('23:59')).toBe(1439);
    });
  });

  describe('formatDateOnlyBR', () => {
    it('converts YYYY-MM-DD to DD/MM/AAAA', () => {
      expect(formatDateOnlyBR('2026-09-01')).toBe('01/09/2026');
    });
  });
});
