import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import fixture from './fixtures/workout.example.json';
import { formatDuration, parseWorkout } from '../src/lib/workouts';

const payloadKeys = ['blocks', 'date', 'duration_max', 'duration_min', 'focus', 'name', 'slug'];

describe(`workout contract ${fixture._contract_version}`, () => {
  it('has only the public payload keys after fixture metadata is removed', () => {
    const { _comment, _contract_version, ...payload } = fixture;
    expect(_comment).toContain('Track A');
    expect(_contract_version).toMatch(/^\d{4}-\d{2}-\d{2}\.\d+$/);
    expect(Object.keys(payload).sort()).toEqual(payloadKeys);
    for (const block of payload.blocks) {
      expect(Object.keys(block).sort()).toEqual(['movements', 'name', 'prescription']);
    }
  });

  it('renders the complete contract workout into static HTML', () => {
    const html = readFileSync(`dist/workouts/${fixture.slug}/index.html`, 'utf8');
    expect(html).toContain(fixture.name);
    expect(html).toContain(fixture.focus);
    expect(html).toContain('Spanish squat, band');
    expect(html).toContain('60–75 min');
    expect(html).toContain('<article');
  });

  it('includes every generated workout URL in the sitemap', () => {
    const sitemap = readFileSync('dist/sitemap.xml', 'utf8');
    expect(sitemap).toContain(`https://silverbackbarbell.com/workouts/${fixture.slug}/`);
  });

  it('accepts the nullable fields added in contract 2026-09-09.3', () => {
    const nullable = structuredClone(fixture) as Record<string, unknown>;
    nullable.focus = null;
    nullable.duration_min = null;
    nullable.duration_max = null;
    nullable.blocks = [
      { name: 'COOL-DOWN', prescription: null, movements: [{ name: 'Easy walk', detail: null }] },
      { name: null, prescription: '1 round', movements: [] },
    ];
    const workout = parseWorkout(nullable);
    expect(workout.focus).toBeNull();
    expect(workout.blocks[0]?.prescription).toBeNull();
    expect(workout.blocks[1]?.name).toBeNull();
    expect(formatDuration(workout)).toBeNull();
  });

  it('accepts a published workout with no blocks', () => {
    expect(parseWorkout({ ...fixture, blocks: [] }).blocks).toEqual([]);
  });

  it('rejects empty strings and malformed nullable values', () => {
    expect(() => parseWorkout({ ...fixture, focus: '' })).toThrow(/focus/);
    expect(() => parseWorkout({ ...fixture, duration_min: '60' })).toThrow(/duration_min/);
  });
});
