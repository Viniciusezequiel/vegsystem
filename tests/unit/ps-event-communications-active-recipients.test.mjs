import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(
  new URL(
    '../../supabase/functions/ps-event-communications/index.ts',
    import.meta.url
  ),
  'utf8'
);

test('comunicações não são enfileiradas para recusados ou substituídos', () => {
  assert.match(
    source,
    /inactive_recipients/
  );

  assert.match(
    source,
    /pending_confirmation[\s\S]*confirmed/
  );

  assert.match(
    source,
    /participation_status/
  );
});

test('jobs antigos são cancelados se participante deixar de estar operacional', () => {
  assert.match(
    source,
    /inactive_participant/
  );

  assert.match(
    source,
    /status:'cancelled'/
  );
});

test('pedido de confirmação só é enviado para quem ainda está pendente', () => {
  assert.match(
    source,
    /confirmation_recipient_not_pending/
  );

  assert.match(
    source,
    /communication_type==='confirmation_request'/
  );

  assert.match(
    source,
    /participation_status!=='pending_confirmation'/
  );
});
