const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const { currentPurchaseTitle, isGenericPurchaseTitle, repairAutomaticPurchaseTitle } = require('../src/lib/docx/purchaseTitle.ts');

const rows = (...descriptions) => descriptions.map(descripcion => ({ descripcion }));
const instruments = rows('Calibrador digital', 'Micrómetro exterior', 'Medidor láser', 'Multímetro digital');
const generic = 'Adquisición de los bienes detallados en el presente documento';
for (const title of [generic, 'Contratación de los servicios detallados en el presente documento.', 'Adquisición de bienes', '[PENDIENTE]', '']) {
  assert.equal(isGenericPurchaseTitle(title), true, title);
}
assert.equal(isGenericPurchaseTitle('Adquisición de instrumentos de medición'), false);
assert.equal(isGenericPurchaseTitle('Adquisición de materiales para redes de distribución'), false);
const scope = { title: 'Adquisición de botines de seguridad', category: 'Bienes', items: instruments };
assert.equal(currentPurchaseTitle(scope), 'Adquisición de instrumentos de medición');
assert.equal(repairAutomaticPurchaseTitle(generic, scope), 'Adquisición de instrumentos de medición');
assert.equal(repairAutomaticPurchaseTitle(scope.title, scope), 'Adquisición de instrumentos de medición');
assert.equal(repairAutomaticPurchaseTitle(generic, scope, true), generic);
assert.equal(repairAutomaticPurchaseTitle(scope.title, scope, true), scope.title);

const specific = 'Adquisición de instrumentos de medición para seguridad industrial';
assert.equal(currentPurchaseTitle({ ...scope, title: specific }), specific);
const uncommonInstruments = { ...scope, title: specific, items: rows('Dosímetro de ruido', 'Multímetro digital') };
assert.equal(currentPurchaseTitle(uncommonInstruments), specific, 'Un instrumento fuera del diccionario no invalida el título registrado');
assert.equal(repairAutomaticPurchaseTitle(generic, uncommonInstruments), specific);
assert.equal(repairAutomaticPurchaseTitle(specific, uncommonInstruments), specific);
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: rows('Sonómetro digital', 'Alcoholímetro portátil') }), 'Adquisición de instrumentos de medición');
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: uncommonInstruments.items }), 'Adquisición de dosímetro de ruido y multímetro digital');
const liveLineTitle = 'adquisicion de herramientas para linea viva';
const liveLine = { title: liveLineTitle, category: 'Bienes', items: rows('Montacargas de 2 poleas', 'Cama o cuna de 6 pies para aisladores', 'Desarmador de cabeza plana', 'Abrazaderas', 'Pastecas', 'Gancho de nylon para pértigas', 'Tijera cortacable') };
assert.equal(currentPurchaseTitle(liveLine), liveLineTitle, 'Se conserva el alcance específico del expediente de línea viva');
assert.equal(repairAutomaticPurchaseTitle(generic, liveLine), liveLineTitle, 'El encabezado genérico usa el título contextual y evita enumerar siete ítems');
assert.equal(currentPurchaseTitle({ ...scope, title: 'Adquisición de instrumentos de medición', items: rows('Botines de seguridad', 'Casco de seguridad') }), 'Adquisición de equipos de protección personal', 'Una familia distinta claramente identificada sí permite corregir un título obsoleto');
assert.equal(currentPurchaseTitle({ ...scope, title: 'COMPRA DE CABLE', items: rows('Cable de cobre') }), 'COMPRA DE CABLE');
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: rows('Multímetro digital') }), 'Adquisición de multímetro digital');
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: rows('Adquisición de multímetro digital') }), 'Adquisición de multímetro digital');
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: rows('Cable de cobre', 'Papel tamaño carta', 'Impresora láser', 'Guante de cuero') }), 'Adquisición de cable de cobre, papel tamaño carta, impresora láser y otro ítem');
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: rows('Casco de seguridad', 'Guante de cuero') }), 'Adquisición de equipos de protección personal');
assert.equal(currentPurchaseTitle({ ...scope, title: generic, items: rows('Casco de seguridad', 'Cable de cobre') }), 'Adquisición de casco de seguridad y cable de cobre');
assert.equal(currentPurchaseTitle({ title: 'Contratación de los servicios detallados en el presente documento', category: 'Servicios', items: rows('Servicio de limpieza industrial') }), 'Contratación de servicio de limpieza industrial');
assert.equal(currentPurchaseTitle({ category: 'Servicios', items: rows('Limpieza de oficinas', 'Mantenimiento de ascensores') }), 'Contratación de limpieza de oficinas y mantenimiento de ascensores');
assert.equal(currentPurchaseTitle({ items: [] }), '[PENDIENTE]');
assert.equal(currentPurchaseTitle({ title: specific, items: [] }), specific);
assert.equal(currentPurchaseTitle({ ...scope, title: 'Adquisición de materiales para redes de distribución', items: rows('Cable de cobre', 'Conector bimetálico') }), 'Adquisición de materiales para redes de distribución');
assert.equal(currentPurchaseTitle({ ...scope, title: 'Adquisición de equipos de protección personal', items: instruments }), 'Adquisición de instrumentos de medición');
assert.equal(repairAutomaticPurchaseTitle('Título escrito directamente por la persona', scope, true), 'Título escrito directamente por la persona');
console.log('PASS títulos específicos: alcance vigente, ítems reales, familias justificadas, servicios, sin duplicar adquisición y correcciones manuales conservadas');
