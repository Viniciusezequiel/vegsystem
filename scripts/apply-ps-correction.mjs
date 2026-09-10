import fs from 'node:fs';

const homePath = 'src/pages/processo-seletivo/PsHome.tsx';
const detailPath = 'src/pages/processo-seletivo/PsEventDetail.tsx';

let home = fs.readFileSync(homePath, 'utf8');
const bannerStartMarker = '      <div className="mt-5 rounded-2xl border border-primary/15';
const mainGridMarker = '      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_300px]">';
const bannerStart = home.indexOf(bannerStartMarker);
const mainGridStart = home.indexOf(mainGridMarker, bannerStart);
if (bannerStart < 0 || mainGridStart < 0 || mainGridStart <= bannerStart) {
  throw new Error('Nao foi possivel localizar o banner da Central para remocao.');
}
home = home.slice(0, bannerStart) + home.slice(mainGridStart);
fs.writeFileSync(homePath, home);

let detail = fs.readFileSync(detailPath, 'utf8');
const communicationImport = "import { PsEventCommunicationTab } from '@/components/processo-seletivo/PsEventCommunicationTab';\n";
const editDialogImport = "import { PsEventCollaboratorEditDialog } from '@/components/processo-seletivo/PsEventCollaboratorEditDialog';\n";
if (!detail.includes(editDialogImport)) {
  if (!detail.includes(communicationImport)) throw new Error('Import de comunicacao nao localizado.');
  detail = detail.replace(communicationImport, communicationImport + editDialogImport);
}

const editStartMarker = '      {/* Editar item importado */}';
const layoutEndMarker = '\n    </MainLayout>\n  );\n}';
const editStart = detail.indexOf(editStartMarker);
const layoutEnd = detail.indexOf(layoutEndMarker, editStart);
if (editStart < 0 || layoutEnd < 0 || layoutEnd <= editStart) {
  throw new Error('Modal antigo de edicao nao localizado.');
}

const replacement = `      <PsEventCollaboratorEditDialog
        eventId={id!}
        link={editLink}
        roles={roles as any[]}
        open={!!editLink}
        onOpenChange={(open) => !open && setEditLink(null)}
      />`;

detail = detail.slice(0, editStart) + replacement + detail.slice(layoutEnd);

if (detail.includes('<Label>Função</Label><Input value={editLink.role_name')) {
  throw new Error('Campo livre de funcao permaneceu no modal antigo.');
}
if (!detail.includes('<PsEventCollaboratorEditDialog')) {
  throw new Error('Novo modal nao foi conectado.');
}

fs.writeFileSync(detailPath, detail);
console.log('Correcoes de PsHome e PsEventDetail aplicadas.');
