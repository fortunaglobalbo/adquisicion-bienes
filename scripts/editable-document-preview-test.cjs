const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
require.extensions['.ts'] = (m, file) => m._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) { return resolve.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, ...args); };
const { FIXED_MODELS } = require('../src/lib/docx/fixedModels.ts');
const { seedFixedDraft, renderFixedWord } = require('../src/lib/server/fixedDocuments.ts');
const { editableDocumentPreview } = require('../src/lib/server/editableDocumentPreview.ts');
const adq = { id: 'editable-test', empresa_id: 'ende', codigo: 'PRUEBA', titulo_proceso: 'Compra de prueba', categoria: 'Bienes', responsable_proceso: 'Persona de prueba', unidad_solicitante: 'Unidad de prueba', lugar_entrega: 'Oruro', plazo_entrega_dias: 30, prevision_presupuesto: 10, items: [{ id: 'item-1', item: 1, descripcion: 'Descripción repetida', unidad: 'Pza', cantidad: 4, precioUnitarioEstimado: 2.5, especificacionMinima: 'Características de prueba' }] };

async function main() {
  fs.mkdirSync(path.join(root, 'test-results', 'editable-document-preview'), { recursive: true });
  for (const model of FIXED_MODELS) {
    const draft = seedFixedDraft(model.number, adq);
    for (const field of model.fields) draft.fields[field.key] = 'DATO REPETIDO';
    if (model.number === 6) for (const key of ['destinatario', 'via', 'solicitante']) draft.fields[key] = 'DATO REPETIDO\nCargo repetido\nSegunda línea del cargo';
    draft.items = model.columns.length ? [0, 1].map(index => Object.fromEntries(model.columns.map(column => [column.key, column.key === 'numero' ? String(index + 1) : column.key === 'cantidad' ? '4' : column.key === 'precio' ? '2.50' : 'Descripción repetida']))) : [];
    const output = await renderFixedWord(model.number, draft);
    const originalBytes = Buffer.from(output.buffer);
    const html = await editableDocumentPreview(output.buffer, output.draft, model);
    assert.deepEqual(output.buffer, originalBytes, 'El editor no debe modificar el Word original');
    assert.ok(!html.includes('{{'), 'No deben aparecer placeholders internos');
    assert.ok(!html.includes('ENDEEDIT'), 'No deben aparecer tokens internos');
    assert.ok(html.includes(`data-fixed-field="${model.fields[0].key}"`), `El primer campo de ${model.number} se debe mapear desde la plantilla`);
    const keys = [...html.matchAll(/data-fixed-field="([a-z_]+)"/g)].map(match => match[1]);
    assert.ok(keys.every(key => model.fields.some(field => field.key === key)), 'Solo se editan campos registrados');
    if (draft.items.length) {
      for (const index of [0, 1]) for (const column of model.columns.filter(column => column.key !== 'numero')) assert.ok(html.includes(`data-fixed-row="${index}" data-fixed-column="${column.key}"`), `Debe mapear cada celda de ${model.number}/${index}/${column.key}`);
      assert.ok(!html.includes('data-fixed-column="numero"'), 'La numeración automática no debe aparentar ser editable');
    }
    if (model.number === 2) {
      assert.ok(html.includes('rowspan="4"'), 'Se conservan las celdas combinadas del formulario S1');
      assert.ok(html.includes('data-fixed-field="almacen" data-fixed-choice="Con saldo"'));
      assert.ok(html.includes('data-fixed-field="almacen" data-fixed-choice="Sin saldo"'));
    }
    if (model.number === 3) assert.ok(!html.includes('data-fixed-field="presupuesto"'), 'El total calculado permanece de solo lectura');
    if (model.number === 6) {
      assert.ok(html.includes('alt="ENDE DEORURO"'), 'Se conserva el logo institucional');
      for (const key of ['destinatario', 'via', 'solicitante']) {
        assert.ok(html.includes(`data-fixed-field="${key}" data-fixed-part="name"`));
        assert.ok(html.includes(`data-fixed-field="${key}" data-fixed-part="role"`));
      }
      assert.ok(html.includes('Cargo repetido<br>Segunda línea del cargo'));
    }
    fs.writeFileSync(path.join(root, 'test-results', 'editable-document-preview', `modelo-${model.number}.html`), html);
  }
  console.log('PASS siete plantillas: mapping por placeholder, valores repetidos, referencias, logo, celdas combinadas y Word original intacto');
  const model = FIXED_MODELS[0];
  const unsafe = seedFixedDraft(1, adq);
  unsafe.fields.antecedentes = '<script>alert("inyección")</script>\nTexto & información';
  unsafe.items[0].descripcion = '<img src=x onerror=alert(1)>';
  const output = await renderFixedWord(1, unsafe);
  const html = await editableDocumentPreview(output.buffer, output.draft, model);
  assert.ok(html.includes('&lt;script&gt;alert(&quot;inyección&quot;)&lt;/script&gt;<br>Texto &amp; información'));
  assert.ok(!html.includes('<script>') && !html.includes('<img src=x'));
  assert.ok(html.includes('data-fixed-field="antecedentes"'));
  console.log('PASS texto multilineal escapado sin ejecutar HTML del usuario');
  const s1 = seedFixedDraft(2, adq);
  s1.fields.almacen = 'Con saldo';
  s1.fields.publicar_precio = 'No';
  s1.fields.con_presupuesto = '[PENDIENTE]';
  const form = await renderFixedWord(2, s1);
  const formHtml = await editableDocumentPreview(form.buffer, form.draft, FIXED_MODELS[1]);
  assert.equal((formHtml.match(/aria-checked="true"/g) || []).length, 2);
  assert.equal((formHtml.match(/>☒<\/span>/g) || []).length, 2);
  const empty = seedFixedDraft(1, { ...adq, items: [] });
  const emptyWord = await renderFixedWord(1, empty);
  const emptyHtml = await editableDocumentPreview(emptyWord.buffer, emptyWord.draft, model);
  assert.ok(emptyHtml.includes('data-fixed-row="0" data-fixed-column="descripcion"'));
  assert.equal(empty.items.length, 0, 'La fila visual no crea un ítem antes de ser editada');
  console.log('PASS checkbox confirmados y primera fila vacía editable sin modificar el borrador');
  const { initialSelection } = require('../src/lib/procurement/selection.ts');
  const planned = seedFixedDraft(1, adq);
  planned.selectionPlan = initialSelection(adq);
  const plannedWord = await renderFixedWord(1, planned);
  const plannedHtml = await editableDocumentPreview(plannedWord.buffer, plannedWord.draft, model);
  assert.ok(plannedHtml.includes('3.2. REQUISITOS MÍNIMOS Y UNIDADES DE ADJUDICACIÓN'), 'Se conservan las tablas adicionales de selección');
  assert.ok(plannedHtml.includes('data-fixed-field="calidad"'), 'Los campos después de las tablas adicionales mantienen su mapping');
  const many = seedFixedDraft(1, adq);
  many.items = Array.from({ length: 30 }, (_v, index) => ({ ...many.items[0], numero: String(index + 1) }));
  const manyWord = await renderFixedWord(1, many);
  const manyHtml = await editableDocumentPreview(manyWord.buffer, manyWord.draft, model);
  assert.ok(manyHtml.includes('data-fixed-row="29" data-fixed-column="descripcion"'));
  assert.ok(manyHtml.includes('data-fixed-field="pago"'));
  console.log('PASS tablas de selección y 30 ítems sin desplazar los campos posteriores');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
