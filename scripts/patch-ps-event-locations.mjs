import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, text) { fs.writeFileSync(path, text); }
function replace(path, from, to) {
  const text = read(path);
  if (!text.includes(from)) throw new Error(`Pattern not found in ${path}: ${from.slice(0, 120)}`);
  write(path, text.replace(from, to));
}
function replaceRange(path, start, end, replacement) {
  const text = read(path);
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0) throw new Error(`Range not found in ${path}: ${start} -> ${end}`);
  write(path, text.slice(0, a) + replacement + text.slice(b));
}

const detail = 'src/pages/processo-seletivo/PsEventDetail.tsx';
replace(detail, "import { normalizePix, preparePixPlan, persistPixPlan } from '@/lib/psPixPlan';\n", '');
replace(detail,
  "import { PsEventCollaboratorEditDialog } from '@/components/processo-seletivo/PsEventCollaboratorEditDialog';\n",
  "import { PsEventCollaboratorEditDialog } from '@/components/processo-seletivo/PsEventCollaboratorEditDialog';\nimport { PsEventLocationsTab } from '@/components/processo-seletivo/PsEventLocationsTab';\nimport { PsManualFiscalLinkDialog } from '@/components/processo-seletivo/PsManualFiscalLinkDialog';\nimport { PsEventEditDialog } from '@/components/processo-seletivo/PsEventEditDialog';\n"
);
replace(detail, "import { buildManualEventCollaboratorRow } from '@/lib/psManualEventCollaboratorSnapshot.mjs';\n", '');
replace(detail,
  '  const { add, update, updateState, remove } = usePsEventCollaboratorMutations(id);',
  '  const { update, updateState, remove } = usePsEventCollaboratorMutations(id);'
);
replace(detail,
  "  const [editLink, setEditLink] = useState<any>(null);\n  const [searchFiscal, setSearchFiscal] = useState('');\n  const [selected, setSelected] = useState<string[]>([]);\n  const [roleValue, setRoleValue] = useState('');\n  const [campusValue, setCampusValue] = useState('');\n  const [pixOverrideById, setPixOverrideById] = useState<Record<string, string>>({});",
  "  const [editLink, setEditLink] = useState<any>(null);\n  const [editEventOpen, setEditEventOpen] = useState(false);"
);
replaceRange(detail,
  '  const visibleCollaborators = useMemo(() => {',
  '  const submitEvaluation = async () => {',
  '  const submitEvaluation = async () => {'
);
replace(detail,
  '            <div className="flex flex-wrap gap-2">\n              <Button variant="outline" onClick={exportBadges}>',
  '            <div className="flex flex-wrap gap-2">\n              <Button variant="outline" onClick={() => setEditEventOpen(true)}><Pencil className="mr-2 h-4 w-4" />Editar evento</Button>\n              <Button variant="outline" onClick={exportBadges}>'
);
replace(detail,
  '              <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>\n              <TabsTrigger value="fiscais">Equipe</TabsTrigger>',
  '              <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>\n              <TabsTrigger value="locais">Locais</TabsTrigger>\n              <TabsTrigger value="fiscais">Equipe</TabsTrigger>'
);
replace(detail,
  '          <TabsContent value="configuracoes" className="space-y-4 pt-4">',
  '          <TabsContent value="locais" className="space-y-4 pt-4">\n            <PsEventLocationsTab eventId={event.id} />\n          </TabsContent>\n\n          <TabsContent value="configuracoes" className="space-y-4 pt-4">'
);
replaceRange(detail,
  '      {/* Vincular fiscais */}',
  '      {/* Avaliar */}',
  `      {/* Vincular fiscais */}\n      <PsManualFiscalLinkDialog\n        eventId={id!}\n        open={addOpen}\n        onOpenChange={setAddOpen}\n        collaborators={collaborators as any[]}\n        links={links as any[]}\n        roles={roles as any[]}\n        rolePay={rolePay}\n      />\n\n      {/* Avaliar */}`
);
replace(detail,
  '      <PsEventCollaboratorEditDialog\n',
  '      <PsEventEditDialog event={event} open={editEventOpen} onOpenChange={setEditEventOpen} />\n\n      <PsEventCollaboratorEditDialog\n'
);

const events = 'src/pages/processo-seletivo/PsEvents.tsx';
replace(events,
  "import { ArrowRight, CalendarDays, MapPin, Plus, Search, Trash2 } from 'lucide-react';",
  "import { ArrowRight, CalendarDays, MapPin, Pencil, Plus, Search, Trash2 } from 'lucide-react';"
);
replace(events,
  "import { PS_EVENT_STATUS } from '@/lib/psConstants';",
  "import { PS_EVENT_STATUS } from '@/lib/psConstants';\nimport { PsEventEditDialog } from '@/components/processo-seletivo/PsEventEditDialog';"
);
replace(events,
  "  const [form, setForm] = useState<any>(emptyForm);",
  "  const [form, setForm] = useState<any>(emptyForm);\n  const [editEvent, setEditEvent] = useState<any>(null);"
);
replace(events,
  `            <div className="grid gap-4 sm:grid-cols-2">\n              <div className="space-y-1.5">\n                <Label className="text-xs text-muted-foreground">Local</Label>\n                <Input value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} />\n              </div>\n              <div className="space-y-1.5">\n                <Label className="text-xs text-muted-foreground">Coordenador</Label>\n                <Input value={form.coordinator_name} onChange={event => setForm({ ...form, coordinator_name: event.target.value })} />\n              </div>\n            </div>`,
  `            <div className="space-y-1.5">\n              <Label className="text-xs text-muted-foreground">Coordenador</Label>\n              <Input value={form.coordinator_name} onChange={event => setForm({ ...form, coordinator_name: event.target.value })} />\n            </div>\n            <div className="rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">Após criar o evento, cadastre ou importe Local, Endereço, Prédio, Andar, Sala e Capacidade na aba <strong>Locais</strong>.</div>`
);
replace(events,
  `                  <Button\n                    size="icon"\n                    variant="outline"\n                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"`,
  `                  <Button size="icon" variant="outline" className="h-9 w-9" onClick={() => setEditEvent(event)} aria-label={\`Editar ${event.name}\`}>\n                    <Pencil className="h-4 w-4" />\n                  </Button>\n                  <Button\n                    size="icon"\n                    variant="outline"\n                    className="h-9 w-9 text-destructive hover:bg-destructive/10 hover:text-destructive"`
);
replace(events,
  '      </Dialog>\n    </MainLayout>',
  '      </Dialog>\n\n      <PsEventEditDialog event={editEvent} open={!!editEvent} onOpenChange={(value) => !value && setEditEvent(null)} />\n    </MainLayout>'
);

const hooks = 'src/hooks/useProcessoSeletivo.ts';
replace(hooks,
  "  'campus', 'cpf', 'identity_doc', 'email', 'phone', 'mobile', 'pay_value',",
  "  'campus', 'location_id', 'building_id', 'room_id', 'location_address', 'cpf', 'identity_doc', 'email', 'phone', 'mobile', 'pay_value',"
);

const communicationTab = 'src/components/processo-seletivo/PsEventCommunicationTab.tsx';
replace(communicationTab,
  "  {label:'Campus',token:'campus'},{label:'Unidade',token:'unidade'},{label:'Prédio',token:'predio'},{label:'Andar',token:'andar'},",
  "  {label:'Campus',token:'campus'},{label:'Endereço',token:'endereco'},{label:'Unidade',token:'unidade'},{label:'Prédio',token:'predio'},{label:'Andar',token:'andar'},"
);
replace(communicationTab,
  "    campus:previewLink?.campus,unidade:previewLink?.unit,instituicao:previewLink?.institution,setor:previewLink?.sector,",
  "    campus:previewLink?.campus,endereco:previewLink?.location_address,unidade:previewLink?.unit,instituicao:previewLink?.institution,setor:previewLink?.sector,"
);

const core = 'src/lib/psCommunicationCore.mjs';
replace(core, 'Campus/Unidade: {{campus}} / {{unidade}}\nPrédio: {{predio}}', 'Campus/Unidade: {{campus}} / {{unidade}}\nEndereço: {{endereco}}\nPrédio: {{predio}}');
replace(core, "const VARIABLES = ['nome','evento','cargo','unidade','campus','instituicao'", "const VARIABLES = ['nome','evento','cargo','unidade','campus','endereco','instituicao'");

const emailTemplates = 'supabase/functions/_shared/emailTemplates.ts';
replace(emailTemplates,
  '  evento?: string | null; data_evento?: string | null; cargo?: string | null; campus?: string | null;\n  unidade?: string | null;',
  '  evento?: string | null; data_evento?: string | null; cargo?: string | null; campus?: string | null; endereco?: string | null;\n  unidade?: string | null;'
);
replace(emailTemplates,
  "    ['Campus/Unidade', campusUnidade],\n    ['Prédio', String(fields.predio ?? '').trim()],",
  "    ['Campus/Unidade', campusUnidade],\n    ['Endereço', String(fields.endereco ?? '').trim()],\n    ['Prédio', String(fields.predio ?? '').trim()],"
);

const edge = 'supabase/functions/ps-event-communications/index.ts';
replace(edge,
  "const PS_VARIABLE_KEYS=['nome','evento','cargo','unidade','campus','instituicao'",
  "const PS_VARIABLE_KEYS=['nome','evento','cargo','unidade','campus','endereco','instituicao'"
);
replace(edge,
  "select('id,event_id,collaborator_name,email,role_name,assigned_role,unit,campus,institution,sector,building,floor,room,work_schedule,participation_status')",
  "select('id,event_id,collaborator_name,email,role_name,assigned_role,unit,campus,location_address,institution,sector,building,floor,room,work_schedule,participation_status')"
);
replace(edge,
  "campus:link.campus||'',instituicao:link.institution||''",
  "campus:link.campus||'',endereco:link.location_address||'',instituicao:link.institution||''"
);
replace(edge,
  "campus:values.campus,unidade:values.unidade,predio:values.predio",
  "campus:values.campus,endereco:values.endereco,unidade:values.unidade,predio:values.predio"
);

console.log('Processo Seletivo location integration patch applied.');
