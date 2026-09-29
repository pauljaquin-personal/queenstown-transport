export const REPORT_TYPES = {
  congestion: { label: 'Traffic congestion', hours: 2 },
  obstruction: { label: 'Road obstruction or damage', hours: 12 },
  trail: { label: 'Cycle trail issue', hours: 72 },
  accessibility: { label: 'Walking or accessibility issue', hours: 24 },
  other: { label: 'Other traffic problem', hours: 12 },
};
// Area reference points only; reports do not claim an exact incident position.
export const REPORT_AREAS = [
  ['town','Queenstown centre',168.6626,-45.0312],
  ['fernhill','Fernhill / Sunshine Bay',168.6387,-45.0380],
  ['frankton','Frankton',168.7385,-45.0207],
  ['airport','Queenstown Airport',168.7392,-45.0211],
  ['arrowtown','Arrowtown',168.8358,-44.9385],
  ['kelvin','Kelvin Heights',168.728,-45.0475],
  ['arthurs-point','Arthurs Point',168.6845,-44.9820],
  ['shotover-country','Shotover Country',168.773285,-45.0004865],
  ['lake-hayes-estate','Lake Hayes Estate',168.7895,-45.0014],
  ['lake-hayes','Lake Hayes',168.806,-44.974],
  ['hanleys-farm','Hanley’s Farm',168.74536,-45.06751],
  ['jacks-point','Jack’s Point',168.75065,-45.07391],
  ['gibbston','Gibbston',168.97012,-45.02850],
  ['bay','Queenstown Bay',168.6605,-45.0343],
  ['marina','Frankton Marina',168.724,-45.026],
];
