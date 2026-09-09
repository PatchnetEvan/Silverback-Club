interface LiveWorkout {
  slug: string;
  date: string;
  name: string;
  focus: string | null;
  duration_min: number | null;
  duration_max: number | null;
  blocks: Array<{
    name: string | null;
    prescription: string | null;
    movements: Array<{ name: string; detail: string | null }>;
  }>;
}

const root = document.querySelector<HTMLElement>('[data-live-today]');

function el<K extends keyof HTMLElementTagNameMap>(name: K, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(name);
  if (className) node.className = className;
  return node;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.length > 0);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isInteger(value));
}

function isWorkout(value: unknown): value is LiveWorkout {
  if (!value || typeof value !== 'object') return false;
  const workout = value as Record<string, unknown>;
  if (typeof workout.slug !== 'string' || typeof workout.date !== 'string' || typeof workout.name !== 'string'
    || !isNullableString(workout.focus) || !isNullableNumber(workout.duration_min)
    || !isNullableNumber(workout.duration_max) || !Array.isArray(workout.blocks)) return false;

  return workout.blocks.every((value) => {
    if (!value || typeof value !== 'object') return false;
    const block = value as Record<string, unknown>;
    return isNullableString(block.name) && isNullableString(block.prescription) && Array.isArray(block.movements)
      && block.movements.every((value) => {
        if (!value || typeof value !== 'object') return false;
        const movement = value as Record<string, unknown>;
        return typeof movement.name === 'string' && movement.name.length > 0 && isNullableString(movement.detail);
      });
  });
}

function duration(workout: LiveWorkout): string | null {
  if (workout.duration_min === null && workout.duration_max === null) return null;
  if (workout.duration_min !== null && workout.duration_max !== null && workout.duration_min !== workout.duration_max) {
    return `${workout.duration_min}–${workout.duration_max} min`;
  }
  return `${workout.duration_min ?? workout.duration_max} min`;
}

function buildArticle(workout: LiveWorkout): HTMLElement {
  const article = el('article', 'workout');
  article.dataset.workoutArticle = '';
  article.dataset.workoutSlug = workout.slug;
  article.dataset.workoutJson = JSON.stringify(workout);
  article.setAttribute('aria-live', 'polite');

  const eyebrow = el('p', 'eyebrow');
  const date = el('time');
  date.dateTime = workout.date;
  date.textContent = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${workout.date}T00:00:00Z`));
  eyebrow.append(date, document.createTextNode(' · '), `${workout.blocks.length} blocks`);
  const durationText = duration(workout);
  if (durationText) eyebrow.append(document.createTextNode(' · '), durationText);

  const heading = el('h2');
  heading.textContent = workout.name;
  article.append(eyebrow, heading);
  if (workout.focus) {
    const focus = el('p', 'standfirst');
    focus.textContent = workout.focus;
    article.append(focus);
  }

  const blocks = el('div', 'workout__blocks');
  for (const block of workout.blocks) {
    const section = el('section', 'workout-block');
    if (block.name) {
      const title = el('h3');
      title.textContent = block.name;
      section.append(title);
    }
    if (block.prescription) {
      const prescription = el('p', 'workout-block__prescription');
      prescription.textContent = block.prescription;
      section.append(prescription);
    }
    if (block.movements.length) {
      const list = el('ul', 'movement-list');
      for (const movement of block.movements) {
        const item = el('li', movement.detail ? '' : 'movement-list__single');
        const name = el('span');
        name.textContent = movement.name;
        item.append(name);
        if (movement.detail) {
          const detail = el('span', 'movement-list__detail');
          detail.textContent = movement.detail;
          item.append(detail);
        }
        list.append(item);
      }
      section.append(list);
    }
    blocks.append(section);
  }
  article.append(blocks);

  const credit = el('p', 'workout__credit');
  const appLink = el('a');
  appLink.href = '/app/';
  appLink.textContent = '3-2-1 Log';
  credit.append('We run these sessions in ', appLink, '.');
  article.append(credit);
  return article;
}

function renderWorkout(workout: LiveWorkout): void {
  if (!root) return;
  const existing = root.querySelector<HTMLElement>('[data-workout-article]');
  if (existing?.dataset.workoutJson === JSON.stringify(workout)) return;

  const slot = root.querySelector<HTMLElement>('[data-live-workout-slot]');
  if (!slot) return;
  slot.replaceChildren(buildArticle(workout));

  const nyDate = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/New_York' }).format(new Date());
  const sessionDate = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${workout.date}T00:00:00Z`));
  const label = root.querySelector<HTMLElement>('[data-session-label]');
  if (label) label.textContent = workout.date === nyDate ? "Today's session" : `Latest session · ${sessionDate}`;

  let permanentLink = root.querySelector<HTMLAnchorElement>('[data-permanent-link]');
  if (!permanentLink) {
    permanentLink = el('a');
    permanentLink.dataset.permanentLink = '';
    permanentLink.textContent = 'Permanent link';
    root.querySelector('.section-heading')?.append(permanentLink);
  }
  permanentLink.href = `/workouts/${workout.slug}/`;
}

if (root?.dataset.apiUrl) {
  fetch(root.dataset.apiUrl, { headers: { Accept: 'application/json' } })
    .then((response) => response.status === 204 ? null : response.ok ? response.json() : null)
    .then((workout: unknown) => { if (isWorkout(workout)) renderWorkout(workout); })
    .catch(() => { /* The complete build-time state stays visible. */ });
}
