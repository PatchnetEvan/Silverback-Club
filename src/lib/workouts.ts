import fixture from '../data/workouts.fixture.json';
import contractFixture from '../../test/fixtures/workout.example.json';

export interface Movement {
  name: string;
  detail: string | null;
}

export interface WorkoutBlock {
  name: string | null;
  prescription: string | null;
  movements: Movement[];
}

export interface Workout {
  slug: string;
  date: string;
  name: string;
  focus: string | null;
  duration_min: number | null;
  duration_max: number | null;
  blocks: WorkoutBlock[];
}

interface WorkoutPage {
  workouts: Workout[];
  next_cursor: string | null;
}

const API_BASE_URL = (process.env.PUBLIC_API_BASE_URL ?? 'https://pro.threetwone.com').replace(/\/$/, '');
const USE_FIXTURE = process.env.USE_WORKOUT_FIXTURE === 'true';
const USE_EMPTY_FIXTURE = process.env.USE_EMPTY_WORKOUT_FIXTURE === 'true';

let workoutsPromise: Promise<Workout[]> | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Invalid workout API response: ${path} must be a non-empty string.`);
  }
  return value;
}

function nullableString(value: unknown, path: string): string | null {
  if (value === null) return null;
  return requireString(value, path);
}

function nullableInteger(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (!Number.isInteger(value)) throw new Error(`Invalid workout API response: ${path} must be an integer or null.`);
  return value as number;
}

export function parseWorkout(value: unknown, index = 0): Workout {
  if (!isRecord(value)) throw new Error(`Invalid workout API response: workouts[${index}] must be an object.`);
  if (!Array.isArray(value.blocks)) throw new Error(`Invalid workout API response: workouts[${index}].blocks must be an array.`);

  return {
    slug: requireString(value.slug, `workouts[${index}].slug`),
    date: requireString(value.date, `workouts[${index}].date`),
    name: requireString(value.name, `workouts[${index}].name`),
    focus: nullableString(value.focus, `workouts[${index}].focus`),
    duration_min: nullableInteger(value.duration_min, `workouts[${index}].duration_min`),
    duration_max: nullableInteger(value.duration_max, `workouts[${index}].duration_max`),
    blocks: value.blocks.map((block, blockIndex) => {
      if (!isRecord(block) || !Array.isArray(block.movements)) {
        throw new Error(`Invalid workout API response: workouts[${index}].blocks[${blockIndex}] is malformed.`);
      }
      return {
        name: nullableString(block.name, `workouts[${index}].blocks[${blockIndex}].name`),
        prescription: nullableString(block.prescription, `workouts[${index}].blocks[${blockIndex}].prescription`),
        movements: block.movements.map((movement, movementIndex) => {
          if (!isRecord(movement)) {
            throw new Error(`Invalid workout API response: movement ${movementIndex} is malformed.`);
          }
          return {
            name: requireString(movement.name, `movement ${movementIndex}.name`),
            detail: nullableString(movement.detail, `movement ${movementIndex}.detail`),
          };
        }),
      };
    }),
  };
}

function parsePage(value: unknown): WorkoutPage {
  if (!isRecord(value) || !Array.isArray(value.workouts)) {
    throw new Error('Invalid workout API response: expected { workouts, next_cursor }.');
  }
  return {
    workouts: value.workouts.map(parseWorkout),
    next_cursor: typeof value.next_cursor === 'string' ? value.next_cursor : null,
  };
}

async function fetchWorkoutPage(cursor?: string): Promise<WorkoutPage> {
  const url = new URL(`${API_BASE_URL}/api/public/workouts`);
  url.searchParams.set('limit', '100');
  if (cursor) url.searchParams.set('cursor', cursor);

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Workout API request failed (${response.status} ${response.statusText}) at ${url}. Build aborted.`);
  }
  return parsePage(await response.json());
}

async function fetchAllWorkouts(): Promise<Workout[]> {
  if (USE_FIXTURE) {
    if (USE_EMPTY_FIXTURE) {
      console.warn('WARNING: Local fixture contains a valid empty archive; building the empty state.');
      return [];
    }
    return [
      parseWorkout(contractFixture, 0),
      ...parsePage(fixture).workouts.filter((workout) => workout.slug !== contractFixture.slug),
    ].sort((a, b) => b.date.localeCompare(a.date));
  }

  const workouts: Workout[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await fetchWorkoutPage(cursor);
    workouts.push(...page.workouts);
    cursor = page.next_cursor ?? undefined;
    if (cursor && seenCursors.has(cursor)) throw new Error('Workout API returned a repeated cursor. Build aborted.');
    if (cursor) seenCursors.add(cursor);
  } while (cursor);

  if (workouts.length === 0) console.warn('WARNING: Workout API returned a valid empty archive; building the empty state.');
  return workouts.sort((a, b) => b.date.localeCompare(a.date));
}

export function getAllWorkouts(): Promise<Workout[]> {
  workoutsPromise ??= fetchAllWorkouts();
  return workoutsPromise;
}

export async function getTodayWorkout(): Promise<Workout | null> {
  if (USE_FIXTURE) return (await getAllWorkouts())[0] ?? null;
  const url = `${API_BASE_URL}/api/public/today`;
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 204) return null;
  if (!response.ok) {
    throw new Error(`Today's workout API request failed (${response.status} ${response.statusText}) at ${url}. Build aborted.`);
  }
  return parseWorkout(await response.json(), 0);
}

export function getNewYorkDate(): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/New_York',
  }).format(new Date());
}

export function getPublicApiBaseUrl(): string {
  return API_BASE_URL;
}

export function formatDuration(workout: Workout): string | null {
  const { duration_min: min, duration_max: max } = workout;
  if (min === null && max === null) return null;
  if (min !== null && max !== null && min !== max) return `${min}–${max} min`;
  return `${min ?? max} min`;
}

export function formatWorkoutDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatWorkoutMonth(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}

export function formatSessionLabelDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`));
}
