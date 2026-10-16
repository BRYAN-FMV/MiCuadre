import { describe, it, expect } from 'vitest';
import { matchesDateFilter, DateFilterPeriod } from './dateFilter';

describe('matchesDateFilter utility', () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();

  const todayIso = new Date(year, month, day, 12, 0, 0).toISOString();
  const yesterdayIso = new Date(year, month, day - 1, 12, 0, 0).toISOString();
  const fourDaysAgoIso = new Date(year, month, day - 4, 12, 0, 0).toISOString();
  const tenDaysAgoIso = new Date(year, month, day - 10, 12, 0, 0).toISOString();
  const twoMonthsAgoIso = new Date(year, month - 2, 15, 12, 0, 0).toISOString();

  it('should return true for ALL regardless of date', () => {
    expect(matchesDateFilter(todayIso, 'ALL')).toBe(true);
    expect(matchesDateFilter(twoMonthsAgoIso, 'ALL')).toBe(true);
    expect(matchesDateFilter(undefined, 'ALL')).toBe(true);
  });

  it('should filter TODAY correctly', () => {
    expect(matchesDateFilter(todayIso, 'TODAY')).toBe(true);
    expect(matchesDateFilter(yesterdayIso, 'TODAY')).toBe(false);
    expect(matchesDateFilter(twoMonthsAgoIso, 'TODAY')).toBe(false);
  });

  it('should filter WEEK correctly (last 7 days)', () => {
    expect(matchesDateFilter(todayIso, 'WEEK')).toBe(true);
    expect(matchesDateFilter(yesterdayIso, 'WEEK')).toBe(true);
    expect(matchesDateFilter(fourDaysAgoIso, 'WEEK')).toBe(true);
    expect(matchesDateFilter(tenDaysAgoIso, 'WEEK')).toBe(false);
  });

  it('should filter MONTH correctly (current month)', () => {
    const startOfCurrentMonthIso = new Date(year, month, 1, 10, 0, 0).toISOString();
    expect(matchesDateFilter(startOfCurrentMonthIso, 'MONTH')).toBe(true);
    expect(matchesDateFilter(todayIso, 'MONTH')).toBe(true);
    expect(matchesDateFilter(twoMonthsAgoIso, 'MONTH')).toBe(false);
  });

  it('should filter CUSTOM date correctly', () => {
    const customDay = '2026-05-18';
    const matchingIso = new Date(2026, 4, 18, 14, 30, 0).toISOString();
    const differentDayIso = new Date(2026, 4, 19, 14, 30, 0).toISOString();

    expect(matchesDateFilter(matchingIso, 'CUSTOM', customDay)).toBe(true);
    expect(matchesDateFilter(differentDayIso, 'CUSTOM', customDay)).toBe(false);
  });

  it('should safely handle invalid or missing date inputs', () => {
    expect(matchesDateFilter(null, 'TODAY')).toBe(false);
    expect(matchesDateFilter(undefined, 'WEEK')).toBe(false);
    expect(matchesDateFilter('invalid-date-string', 'TODAY')).toBe(false);
  });
});
