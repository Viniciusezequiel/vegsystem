## Escopo

Quatro frentes no módulo de Reservas de Sala, **sem mexer em outros módulos**.

---

### 1. Filtros da página `/reservations` (limpeza visual)

- Manter visíveis: **Busca**, **Data (range)**, **Status**.
- Mover para dropdown "Mais filtros" (popover): **Sala**, **Campus**, **Tipo (interna/externa)**, **Fixa**, **Solicitante**.
- Badges abaixo mostram filtros ativos com X para remover individualmente.
- Botão "Limpar filtros" quando houver qualquer ativo.

### 2. Configuração de Salas (Gestão de Salas → Salas de Reserva)

Adicionar dois campos novos em `reservation_rooms`:
- **`observations`** (text) — observações livres sobre o espaço.
- **`equipment`** (jsonb) — lista de equipamentos já presentes (ex.: projetor, lousa, ar-condicionado).

Atualizar o formulário de criar/editar sala com:
- Textarea "Observações".
- Campo de tags/lista dinâmica "Equipamentos disponíveis".

Exibir essas infos nos cards de seleção de sala (busca de disponibilidade) e no painel público.

### 3. Visualização das reservas — Calendário + Lista

Na página `/reservations`, adicionar **toggle no topo**: `[ Lista ] [ Calendário ]`.

- **Lista**: layout atual já existente, mantido.
- **Calendário**: novo componente com visões **Mês / Semana / Dia**, eventos coloridos por status, clique abre o detalhe da reserva (reaproveita dialog existente). Filtros aplicados afetam ambos.

Usar `react-big-calendar` (já compatível com o stack) ou implementação custom leve baseada em date-fns. Vou usar `react-big-calendar` para entrega rápida.

### 4. Portal externo de clientes (`/portal-cliente`)

**Fluxo de cadastro (auto-cadastro + aprovação manual):**
- Rota pública `/portal-cliente/cadastro`: cliente preenche nome, email, telefone, CPF, organização, senha.
- Cria registro em `auth.users` + linha em `external_users` com novo campo **`approval_status`** (`pending` | `approved` | `rejected`).
- Enquanto `pending`, login é bloqueado com mensagem "Cadastro em análise".
- Internos veem fila de aprovação em nova aba dentro de **Usuários Externos** (área admin existente). Botões Aprovar/Rejeitar.

**Área logada do cliente (`/portal-cliente/*`):**
- **Dashboard**: próximas reservas + atalhos.
- **Nova reserva**: reusa lógica de "buscar disponibilidade" (find_available_rooms) em layout mais visual e guiado (passo a passo: data → horário → participantes → sala disponível → confirmar).
- **Minhas reservas**: tabs `Futuras` / `Passadas` / `Canceladas`, com cards mostrando sala, data, status.
- **Ações por reserva**: 
  - **Cancelar** (políticas RLS já permitem).
  - **Remarcar**: cria nova reserva com vínculo à original; status pendente até aprovação interna.
- Visual independente do sistema interno: layout limpo, sem sidebar admin, header próprio com nome do cliente e logout.

**Segurança:**
- RLS: clientes externos só veem/alteram suas próprias reservas (já parcialmente implementado via `requester_email = auth.email()`).
- Adicionar política de bloqueio em login client-side: se `approval_status != 'approved'`, faz signOut com mensagem.
- Reservas criadas pelo portal entram com `status = 'pending'` e `is_external = true`.

---

## Detalhes técnicos

**Migrações:**
```sql
ALTER TABLE reservation_rooms 
  ADD COLUMN observations text,
  ADD COLUMN equipment jsonb DEFAULT '[]'::jsonb;

ALTER TABLE external_users 
  ADD COLUMN approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN approved_by uuid,
  ADD COLUMN approved_at timestamptz,
  ADD COLUMN rejection_reason text;

-- RLS: external_users self-insert continua, mas approval_status só admin altera
```

**Novas rotas:**
- `/portal-cliente` (landing/login)
- `/portal-cliente/cadastro`
- `/portal-cliente/dashboard` (protegida)
- `/portal-cliente/nova-reserva`
- `/portal-cliente/minhas-reservas`
- `/portal-cliente/reserva/:id`

**Arquivos novos:**
- `src/pages/portal-cliente/*` (Login, Cadastro, Dashboard, NovaReserva, MinhasReservas, ReservaDetalhe, Layout)
- `src/components/portal-cliente/PortalLayout.tsx`, `ExternalProtectedRoute.tsx`
- `src/hooks/useExternalReservations.ts`
- `src/components/reservations/ReservationsCalendar.tsx`
- `src/components/reservations/FiltersBar.tsx` (refator dos filtros existentes — **isolado, só usado em RoomReservationsList**)
- `src/components/rooms/RoomEquipmentInput.tsx`

**Arquivos editados (apenas dentro do módulo de reservas/salas):**
- `src/pages/reservations/RoomReservationsList.tsx`
- `src/pages/reservations/ReservationRoomsManagement.tsx`
- `src/pages/Users.tsx` (aba de aprovação de externos — única edição fora de reservas, necessária para o fluxo de aprovação)
- `src/App.tsx` (registrar rotas do portal)

**Dependências:** `react-big-calendar` + tipos.

---

## Entrega

Pela amplitude, sugiro implementar em 2 PRs lógicos no mesmo turno:
1. **Bloco A**: filtros + observações/equipamentos da sala + calendário (mexe só em reservas).
2. **Bloco B**: portal externo completo + aprovação.

Vou entregar tudo em sequência, validando o build entre eles. Confirma para eu começar?