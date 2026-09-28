import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareNetwork, findRoute } from '../public/src/routing/network.js';

const SH6_SHOTOVER_BRIDGE = [168.75818, -45.00143];
const FRANKTON = [168.7305316, -45.016644];
const SHOTOVER_COUNTRY = [168.7732850, -45.0004865];

function metres(a, b) {
  const r = Math.PI / 180;
  const h = Math.sin((b[1] - a[1]) * r / 2) ** 2 +
    Math.cos(a[1] * r) * Math.cos(b[1] * r) *
    Math.sin((b[0] - a[0]) * r / 2) ** 2;
  return 12742000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

test('usual cycling uses Twin Rivers and avoids SH6 Shotover bridge', () => {
  const data = JSON.parse(readFileSync(new URL('../public/data/cycle-network.v1.json', import.meta.url), 'utf8'));
  const network = prepareNetwork(data);
  const route = findRoute(network, FRANKTON, SHOTOVER_COUNTRY, {
    profile:'quiet',
    start:'Frankton · Gray Street',
    end:'Shotover Country · Stalker Road',
  });

  const labels = route.features.flatMap(feature => [
    feature.properties.name || '',
    ...(feature.properties.networks || []),
  ]);
  assert.ok(
    labels.some(label => /Twin Rivers/i.test(label)),
    'Expected the usual cycling route to use the Twin Rivers Trail connection'
  );

  const closest = Math.min(...route.features.flatMap(feature =>
    feature.geometry.coordinates.map(point => metres(point, SH6_SHOTOVER_BRIDGE))
  ));
  assert.ok(
    closest > 260,
    `Usual cycling route came within ${Math.round(closest)} m of the SH6 Shotover bridge`
  );
});
