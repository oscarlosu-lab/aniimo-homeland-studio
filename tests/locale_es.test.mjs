import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const spanish = JSON.parse(await readFile(new URL('../web/locales/es.json', import.meta.url)));

// Check slots consistency for templates
for (const [source, target] of Object.entries(spanish)) {
    if (source.includes('{') && target.includes('{')) {
        const slots = text => new Set(text.match(/\{[a-z_]+\}/gi) || []);
        assert.deepEqual(slots(source), slots(target), `Slot mismatch in: ${source}`);
    }
}

// Emulate browser environment for i18n.js
const saved = new Map([['aniimax-language', 'es']]);
globalThis.localStorage = { getItem: key => saved.get(key), setItem: (key, value) => saved.set(key, value) };
globalThis.fetch = async url => ({ ok: true, json: async () => JSON.parse(await readFile(url)) });
globalThis.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };
globalThis.NodeFilter = { SHOW_ELEMENT: 1, SHOW_TEXT: 4 };
const node = { nodeType: 3, nodeValue: 'Your Homeland' };
const body = { nodeType: 1, hasAttribute: () => false };
const selector = { value: 'es', add() {}, addEventListener: () => {} };
globalThis.Option = class { constructor(label, value) { this.label = label; this.value = value; } };
globalThis.document = {
    body, documentElement: { lang: 'es' }, title: '', getElementById: () => selector,
    dispatchEvent() {},
    createTreeWalker: () => ({ currentNode: null, index: 0, nextNode() { return false; } }),
};
globalThis.MutationObserver = class { observe() {} };

const { translate, languageReady } = await import('../web/i18n.js');
await languageReady;

// Verified Datamine & Game terms
assert.equal(translate('Harvest Moon Points'), 'Puntos de Luna de Cosecha');
assert.equal(translate('Harvest Moon Festival'), 'Festival de la Luna de Cosecha');
assert.equal(translate('Moonray Wheat'), 'Trigo de rayo de luna');
assert.equal(translate('Home Coins'), 'Monedas del Hogar');
assert.equal(translate('then Home Coins'), 'luego Monedas del Hogar');
assert.equal(translate('level-up time, then Home Coins'), 'tiempo de subida de nivel, luego Monedas del Hogar');

// Items from Datamine
assert.equal(translate('Moondew Radish'), 'Rábano de rocío de luna');
assert.equal(translate('Moondew Radish Slices'), 'Rodajas de rábano de rocío de luna');
assert.equal(translate('Waxing Moon Pepper'), 'Pimiento de luna creciente');
assert.equal(translate('Roasted Waxing Moon Pepper'), 'Pimiento de luna creciente asado');
assert.equal(translate('Harvest Platter'), 'Bandeja de cosecha');
assert.equal(translate('Umbral Hot Pot'), 'Olla caliente sombría');
assert.equal(translate('Umbral Pickle'), 'Encurtido umbral');
assert.equal(translate('Umbral Sweet and Spicy Sauce'), 'Salsa dulce picante sombría');

// Opportunities & Candidate Aniimo
assert.equal(translate('Leisure Aniimo Lv.4'), 'Aniimo de Ocio Nv.4');
assert.equal(translate('Earth Aniimo Lv.4'), 'Aniimo de Tierra Nv.4');
assert.equal(translate('Water Aniimo Lv.4'), 'Aniimo de Agua Nv.4');
assert.equal(translate('+6.2% Home Coins (+5592/h)'), '+6.2% Monedas del Hogar (+5592/h)');
assert.equal(translate('Ranked by Bloques de madera, then Home Coins. 3 of 12 help.'),
    'Clasificado por Bloques de madera, luego Monedas del Hogar. 3 de 12 ayudan.');
assert.equal(translate('Ranked by Bloques de madera, then Home Coins. 3 of 12 help. Within RV 10 limits.'),
    'Clasificado por Bloques de madera, luego Monedas del Hogar. 3 de 12 ayudan. Dentro de los límites de Casa rodante 10.');

console.log('locale_es.test.mjs passed: all Spanish translations match game datamine!');
