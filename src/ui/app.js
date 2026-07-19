const form = document.querySelector('#roast-form');
const input = document.querySelector('#url');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const pelican = document.querySelector('#pelican');
const score = document.querySelector('#score');
const band = document.querySelector('#band');
const roast = document.querySelector('#roast');
const detections = document.querySelector('#detections');
const fixes = document.querySelector('#fixes');
const submit = form.querySelector('button');

const bandLabels = {
  impressed: 'Grudgingly impressed',
  smug: 'Academically smug',
  concerned: 'Scholarly concern',
  horrified: 'Theatrical horror',
  ashes: 'Academic devastation',
};

function renderDetection(item) {
  const chip = document.createElement('span');
  chip.textContent = item.name;
  chip.title = item.category;
  return chip;
}

function renderFix(item) {
  const element = document.createElement('li');
  const heading = document.createElement('strong');
  const rationale = document.createElement('p');
  const kind = document.createElement('span');

  heading.textContent = item.title;
  rationale.textContent = item.rationale;
  kind.textContent = item.kind;
  kind.className = `fix-kind ${item.kind}`;
  element.append(kind, heading, rationale);
  return element;
}

function render(data) {
  pelican.src = `/assets/sprites/pelican-${data.spriteId}.png`;
  pelican.alt = `Dr. Gordon Pelican is ${data.band}`;
  score.textContent = data.score;
  band.textContent = bandLabels[data.band] ?? data.band;
  roast.textContent = data.roast;
  detections.replaceChildren(...data.detections.map(renderDetection));
  fixes.replaceChildren(...data.fixes.map(renderFix));
  result.hidden = false;
  result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  result.hidden = true;
  submit.disabled = true;
  submit.textContent = 'Reviewing…';
  status.textContent = 'Dr. Pelican is peering down his beak at the evidence.';

  try {
    const response = await fetch('/roast', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: input.value }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'The review failed.');

    render(data);
    status.textContent = 'The defense committee has reached a verdict.';
  } catch (error) {
    status.textContent =
      error instanceof Error ? error.message : 'Dr. Pelican misplaced the evidence.';
  } finally {
    submit.disabled = false;
    submit.textContent = 'Defend your stack';
  }
});
