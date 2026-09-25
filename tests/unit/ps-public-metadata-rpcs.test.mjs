import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260902430000_ps_public_metadata_rpcs.sql',
    import.meta.url
  ),
  'utf8'
);

const attendanceSurfaceSql = fs.readFileSync(
  new URL(
    '../../supabase/migrations/20260925102000_ps_attendance_single_open_event.sql',
    import.meta.url
  ),
  'utf8'
);

const attendance = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicAttendance.tsx',
    import.meta.url
  ),
  'utf8'
);

const selfEvaluation = fs.readFileSync(
  new URL(
    '../../src/pages/processo-seletivo/public/PsPublicSelfEvaluation.tsx',
    import.meta.url
  ),
  'utf8'
);

test('metadados públicos são expostos apenas por RPCs mínimos', () => {
  assert.match(sql, /ps_public_list_events/);
  assert.match(sql, /ps_public_list_roles/);

  assert.match(
    sql,
    /REVOKE SELECT ON public\.ps_events FROM anon/
  );

  assert.match(
    sql,
    /REVOKE SELECT ON public\.ps_roles FROM anon/
  );

  assert.doesNotMatch(
    sql.match(
      /CREATE OR REPLACE FUNCTION public\.ps_public_list_roles[\s\S]*?\$\$;/
    )?.[0] || '',
    /pay_value|combined_roles/i
  );
});

test('presença e autoavaliação não dependem das tabelas internas de evento/cargo', () => {
  for (const source of [attendance, selfEvaluation]) {
    assert.match(source, /ps_public_list_events/);
    assert.match(source, /ps_public_list_roles/);

    assert.doesNotMatch(source, /usePsEvents/);
    assert.doesNotMatch(source, /usePsRoles/);

    assert.doesNotMatch(
      source,
      /\.from\(['"]ps_events['"]\)/
    );

    assert.doesNotMatch(
      source,
      /\.from\(['"]ps_roles['"]\)/
    );
  }
});


test('presença pública expõe somente um evento não finalizado e não permite troca manual', () => {
  assert.match(attendanceSurfaceSql, /p_surface = 'attendance'[\s\S]*e\.status <> 'finalizado'/);
  assert.match(attendanceSurfaceSql, /WHEN p_surface = 'attendance' THEN 1/);
  assert.match(attendanceSurfaceSql, /e\.status = 'em_andamento'/);
  assert.match(attendanceSurfaceSql, /WHERE ec\.event_id = p_event_id[\s\S]*e\.status <> 'finalizado'/);
  assert.match(attendance, /Evento da presença/);
  assert.match(attendance, /Eventos finalizados são bloqueados automaticamente/);
  assert.doesNotMatch(attendance, /handleEventChange/);
  assert.doesNotMatch(attendance, /<Select value=\{eventId\}/);
});
