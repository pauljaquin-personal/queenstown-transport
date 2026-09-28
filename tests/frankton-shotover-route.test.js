import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { prepareNetwork, findRoute } from '../public/src/routing/network.js';

const FRANKTON = [168.7305316, -45.016644];
const SHOTOVER_COUNTRY = [168.7732850, -45.0004865];

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
  console.log('ROUTE_DISTANCE_M', Math.round(route.metadata.distanceMetres));
  for (const feature of route.features) {
    console.log('SECTION', JSON.stringify({
      name:feature.properties.name,
      kind:feature.properties.kind,
      busy:feature.properties.busy,
      metres:Math.round(feature.properties.metres),
      networks:feature.properties.networks,
      first:feature.geometry.coordinates[0],
      last:feature.geometry.coordinates.at(-1),
    }));
  }

  assert.ok(
    labels.some(label => /Twin Rivers/i.test(label)),
    'Expected the usual cycling route to use the Twin Rivers Trail connection'
  );
  assert.ok(
    labels.some(label => /Historic Shotover Bridge/i.test(label)),
    'Expected the usual cycling route to cross the Historic Shotover Bridge'
  );
  assert.ok(
    !labels.some(label => /Frankton Ladies Mile Highway/i.test(label)),
    'Usual cycling route must not use the Frankton Ladies Mile Highway / SH6 bridge'
  );
});
