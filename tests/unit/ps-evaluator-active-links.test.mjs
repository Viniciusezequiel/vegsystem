import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902380000_ps_evaluator_active_participants_only.sql',
    import.meta.url
  ),
  'utf8'
);

const portal = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/evaluator/PsEvaluatorPortal.tsx',
    import.meta.url
  ),
  'utf8'
);

const eventsPage = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/PsEvents.tsx',
    import.meta.url
  ),
  'utf8'
);

test('portal do avaliador aceita somente equipe operacional ativa', () => {
  assert.match(
    sql,
    /participation_status\s+IN\s*\([\s\S]*?'pending_confirmation'[\s\S]*?'confirmed'/i
  );

  assert.match(
    sql,
    /ps_validate_evaluator_session/
  );

  assert.match(
    sql,
    /ps_evaluator_link_can_access/
  );

  assert.match(
    sql,
    /ps_public_evaluator_queue/
  );

  assert.match(
    sql,
    /ps_public_evaluator_search_external/
  );

  assert.match(
    sql,
    /ps_evaluator_role_for_assignment[\s\S]*=\s*a\.role/i
  );

  assert.match(
    sql,
    /LIMIT\s+1000/i
  );
});


test('portal do avaliador mantém quantidade de hooks estável entre login, carregamento e sessão', () => {
  assert.doesNotMatch(portal, /useMemo/);
  assert.match(portal, /const areaOptions = \(\(\) => \{/);
  assert.match(portal, /const filteredQueue = \(\(\) => \{/);
  assert.match(portal, /if \(loading\)[\s\S]*if \(!token \|\| !session\)/);
});

test('lista de eventos oculta finalizados por padrão e não os conta como atenção operacional', () => {
  assert.match(eventsPage, /useState\('open'\)/);
  assert.match(eventsPage, /statusFilter === 'open' && event\.status !== 'finalizado'/);
  assert.match(eventsPage, /<SelectItem value="open">Em aberto — padrão<\/SelectItem>/);
  assert.match(eventsPage, /event\.status !== 'finalizado'[\s\S]*eventSummary\.get/);
});
