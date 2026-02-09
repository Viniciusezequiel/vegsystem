# VEG System - Documentação Completa do Projeto

## 📋 Visão Geral

**Nome:** VEG System - Sistema Integrado de Gestão de Recursos Didáticos  
**Stack:** React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Supabase  
**Fonte:** Space Grotesk (display) + JetBrains Mono (monospace)  
**Tema:** Roxo/violeta como cor primária (HSL 265 85% 55%), com suporte a dark mode  
**Autenticação:** Email/senha via Supabase Auth (sem signup público, usuários criados por admin)

---

## 🏗️ Arquitetura

### Frontend
- **Framework:** React 18 com react-router-dom v7
- **Build:** Vite
- **Estilização:** Tailwind CSS com design tokens semânticos em `index.css`
- **Componentes UI:** shadcn/ui (Radix primitives)
- **Estado servidor:** TanStack React Query v5
- **Formulários:** react-hook-form + zod
- **Gráficos:** Recharts
- **PDF:** Geração via edge function
- **Assinatura:** Componente SignaturePad customizado (fabric.js)
- **Excel:** xlsx para exportação

### Backend (Supabase)
- **Banco:** PostgreSQL com RLS (Row Level Security)
- **Auth:** Supabase Auth (email/senha)
- **Storage:** Bucket `lost-items` (público) para imagens
- **Edge Functions:** Deno/TypeScript
- **Realtime:** Supabase Realtime para notificações

---

## 👥 Sistema de Autenticação e Roles

### Roles (enum `app_role`)
| Role | Descrição |
|------|-----------|
| `admin` | Acesso total, gerencia usuários e permissões |
| `supervisor` | Gerencia tarefas, aprovações |
| `analista` | Operações avançadas (cadastro de equipamentos, etc.) |
| `assistente` | Operações básicas |

### Tabelas de Auth
- **`profiles`** - Dados do usuário (full_name, email, position, department, avatar_url, is_active, force_password_change)
- **`user_roles`** - Mapeamento user_id → role
- **`role_permissions`** - Permissões granulares por role/módulo/ação

### Permissões
Módulos: `lostAndFound`, `equipment`, `reservations`, `lockers`, `rooms`, `materials`, `users`, `settings`, `classroomCalls`, `tasks`, `activityHistory`  
Ações: `view`, `create`, `edit`, `delete`, `approve`

### Funções de banco auxiliares
```sql
has_role(user_id, role) → boolean
is_admin(user_id) → boolean
is_admin_or_analista(user_id) → boolean
is_internal_user(user_id) → boolean
has_permission(user_id, module, action) → boolean
```

---

## 📦 Módulos do Sistema

### 1. Achados e Perdidos (`/lost-found`)
**Tabelas:** `lost_items`, `lost_items_archive`

**Campos `lost_items`:**
- `id`, `code` (6 dígitos único), `description`, `image_url`
- `campus` (enum: campus_enum), `found_location`, `found_date`, `received_date`
- `shelf`, `box`, `box_number`, `seal_number`
- `delivered_by_name`, `delivered_by_contact`
- `registered_by` (uuid), `status` (available/pending/delivered/expired)
- Campos de saída: `owner_name`, `owner_email`, `owner_phone`, `owner_signature`, `delivered_at`, `delivered_by_team_member`

**Funcionalidades:**
- Registro de itens encontrados com foto
- Busca com filtros (campus, status, data, texto)
- Entrega com assinatura digital do proprietário
- Arquivamento de itens entregues (move para `lost_items_archive`)
- Expiração automática após 90 dias (`expire_old_lost_items()`)
- Upload em massa de imagens
- Geração de PDF do item
- Virtualização de lista para performance

**Storage:** Bucket `lost-items` (público)

**Rotas:**
- `/lost-found` - Lista de itens
- `/lost-found/register` - Registro
- `/lost-found/items` - Busca
- `/lost-found/items/:id` - Detalhe
- `/lost-found/archived` - Arquivo

---

### 2. Equipamentos (`/equipment`)
**Tabelas:** `equipment`, `equipment_loans`, `equipment_reservations`, `external_equipment_requests`, `inventory_movements`

**Campos `equipment`:**
- `id`, `name`, `patrimony_code`, `category`, `description`, `image_url`
- `campus` (enum), `location`, `quantity`, `available_quantity`
- `status` (enum: available/borrowed/maintenance/unavailable/written_off)
- `allow_external_loan`, `write_off_date`, `write_off_reason`, `write_off_by`
- `created_by`

**Campos `equipment_loans`:**
- `equipment_id`, `quantity_borrowed`, `expected_return_date`, `actual_return_date`
- `borrower_name`, `borrower_phone`, `borrower_sector`, `borrower_type` (aluno/professor/servidor)
- `purpose`, `authorizer_name`, `authorizer_contact` (obrigatório para alunos)
- `collaborator_name` (quem entregou), `return_collaborator_name` (quem recebeu)
- `borrower_signature`, `return_signature`
- `status` (enum: active/returned/overdue/partially_returned)
- `item_condition` (bom/danificado/peças faltando), `pending_items_description`
- `all_items_returned`

**Campos `equipment_reservations`:**
- `equipment_id`, `quantity_reserved`, `scheduled_pickup_date`
- `requester_name`, `requester_phone`, `requester_sector`, `requester_type`
- `purpose`, `status` (awaiting_pickup/picked_up/cancelled/expired)

**Campos `inventory_movements`:**
- `equipment_id`, `movement_type`, `quantity`
- `from_location`, `to_location`, `from_campus`, `to_campus`
- `reason`, `notes`, `performed_by`, `performed_by_name`

**Funcionalidades:**
- CRUD de patrimônio
- Empréstimo com assinatura, termos de responsabilidade
- Devolução com registro de condição
- Devolução parcial
- Reservas de equipamento
- Movimentação de inventário
- Baixa patrimonial (write-off)
- Solicitações externas

**Rotas:**
- `/equipment` - Lista
- `/equipment/register` - Cadastro
- `/equipment/edit/:id` - Edição
- `/equipment/loans` - Empréstimos
- `/equipment/loan/new` - Novo empréstimo
- `/equipment/reservations` - Reservas

---

### 3. Checklist de Salas (`/rooms`)
**Tabelas:** `rooms`, `room_checklists`, `checklist_questions`, `checklist_answers`, `shift_handovers`, `shift_handover_tasks`, `shift_handover_incidents`

**Campos `rooms`:**
- `id`, `name`, `building`, `floor`, `campus` (enum), `capacity`, `description`
- `checklist_items` (jsonb)

**Campos `checklist_questions`:**
- `id`, `question`, `category`, `order_index`, `is_active`

**Campos `room_checklists`:**
- `id`, `room_id`, `shift`, `filled_by`, `filled_at`, `observations`

**Campos `shift_handovers`:**
- `id`, `handover_date`, `shift`, `day_of_week`, `sector`, `unit`
- `collaborator_name`, `collaborator_time`
- `has_impact_incident`, `general_observations`, `filled_by`

**Campos `shift_handover_tasks`:**
- `handover_id`, `task_name`, `answer`, `observation`

**Campos `shift_handover_incidents`:**
- `handover_id`, `incident_type`, `description`, `location`, `treatment`

**Rotas:**
- `/rooms` - Gestão de salas (admin)
- `/rooms/checklist/new` - Novo checklist
- `/rooms/checklists` - Histórico
- `/rooms/shift-handover/new` - Nova passagem de plantão
- `/rooms/shift-handovers` - Histórico de passagens

---

### 4. Escaninhos/Lockers (`/lockers`)
**Tabelas:** `lockers`, `locker_loans`, `locker_exchanges`

**Campos `lockers`:**
- `id`, `code`, `campus` (enum), `location`, `description`
- `status` (enum: available/occupied/maintenance/reserved)

**Campos `locker_loans`:**
- `locker_id`, `borrower_name`, `borrower_phone`, `borrower_email`, `borrower_sector`
- `expected_return_date`, `actual_return_date`
- `borrower_signature`, `return_signature`
- `status` (enum: active/returned/overdue/partially_returned)
- `loaned_by`, `returned_by`, `returner_name`

**Campos `locker_exchanges`:**
- `old_loan_id`, `old_locker_id`, `new_locker_id`, `new_loan_id`
- `reason`, `performed_by`, `performed_by_name`

**Rotas:**
- `/lockers` - Lista
- `/lockers/loan/new` - Nova alocação
- `/lockers/loans` - Alocações ativas

---

### 5. Materiais (`/materials`)
**Tabela:** `material_requests`

**Campos:**
- `id`, `title`, `description`, `items` (jsonb - lista de materiais)
- `requester_id`, `requester_name`
- `priority` (normal/high/urgent), `status` (pending/approved/rejected/in_progress/completed/cancelled)
- `assigned_to`, `assigned_to_name`
- `approved_by`, `approved_at`, `admin_notes`

**Rotas:**
- `/materials` - Gestão (admin)
- `/materials/new` - Nova solicitação
- `/materials/my-requests` - Minhas solicitações

---

### 6. Chamados de Sala (`/classroom-calls`)
**Tabela:** `classroom_calls`

**Campos:**
- `id`, `room_name`, `reason`, `status` (pending/accepted/resolved)
- `accepted_by`, `accepted_by_name`, `accepted_at`
- `resolved_at`, `treatment`
- `is_valid`, `validation_reason`

**Rota pública:** `/chamado-sala` - Formulário sem autenticação (criado via edge function)  
**Rota interna:** `/classroom-calls` - Gestão

---

### 7. Demandas/Tarefas (`/tasks`)
**Tabelas:** `tasks`, `task_comments`, `task_history`, `task_team_members`

**Campos `tasks`:**
- `id`, `title`, `description`, `priority` (low/normal/high/urgent)
- `status` (pending/in_progress/completed/cancelled)
- `category`, `tags` (text[])
- `assigned_to`, `assigned_to_name`, `created_by`, `created_by_name`
- `due_date`, `started_at`, `completed_at`
- `estimated_hours`, `actual_hours`
- `attachments` (jsonb), `notes`

**Campos `task_comments`:**
- `task_id`, `user_id`, `user_name`, `content`

**Campos `task_history`:**
- `task_id`, `user_id`, `user_name`, `action`, `field_changed`, `old_value`, `new_value`

**Campos `task_team_members`:**
- `task_id`, `user_id`, `user_name`

**Rotas:**
- `/tasks` - Gestão (admin)
- `/tasks/my-tasks` - Minhas demandas
- `/tasks/dashboard` - Dashboard (admin)

---

### 8. Reservas de Salas (tabelas existentes, módulo em desenvolvimento)
**Tabelas:** `reservation_rooms`, `reservations`, `reservation_logs`, `reservation_reschedulings`, `room_combinations`, `external_users`

**Funcionalidades planejadas:**
- Reserva de salas com verificação de conflito
- Suporte a usuários externos (com CPF)
- Salas combináveis (room_combinations)
- Buffer de 15min para reservas externas
- Reagendamento com histórico
- Auto-confirmação configurável por sala

---

### 9. Histórico de Atividades (`/activity-history`)
**Tabela:** `activity_logs`

**Campos:**
- `id`, `user_id`, `user_name`, `action`, `module`
- `entity_id`, `entity_description`, `details`, `ip_address`

---

## 🔧 Edge Functions

| Função | Auth | Descrição |
|--------|------|-----------|
| `setup-first-admin` | ❌ JWT | Configura primeiro admin do sistema |
| `create-user` | ✅ | Cria novo usuário (admin only) |
| `delete-user` | ✅ | Remove usuário |
| `reset-password` | ✅ | Reseta senha de usuário |
| `update-user-email` | ❌ JWT | Atualiza email do usuário |
| `create-classroom-call` | ❌ JWT | Cria chamado de sala (público) |
| `generate-pdf` | ✅ | Gera PDF de item |
| `migrate-lost-item-image` | ✅ | Migra imagem de item |
| `migrate-all-images` | ✅ | Migra todas as imagens |

---

## 🗄️ Enums do Banco

```sql
-- campus_enum (verificar valores existentes no banco)
-- Exemplos comuns: 'Unidade I', 'Unidade II', etc.

-- equipment_status
'available', 'borrowed', 'maintenance', 'unavailable', 'written_off'

-- loan_status
'active', 'returned', 'overdue', 'partially_returned'

-- locker_status
'available', 'occupied', 'maintenance', 'reserved'

-- app_role
'admin', 'supervisor', 'analista', 'assistente'
```

---

## 🎨 Design System

### Cores (HSL)
| Token | Light | Dark |
|-------|-------|------|
| `--primary` | 265 85% 55% | 265 85% 65% |
| `--accent` | 190 80% 45% | 190 80% 50% |
| `--success` | 160 75% 40% | 160 75% 45% |
| `--warning` | 38 95% 50% | 38 95% 55% |
| `--destructive` | 0 72% 51% | 0 72% 55% |
| `--background` | 0 0% 100% | 230 25% 7% |

### Utilidades CSS customizadas
- `.glass-card` - Card com glassmorphism
- `.gradient-primary` - Gradiente roxo
- `.gradient-accent` - Gradiente cyan/verde
- `.gradient-text` - Texto com gradiente
- `.mesh-gradient` - Background mesh
- `.glow-primary` - Glow roxo
- `.sidebar-link` / `.sidebar-link-active` - Links da sidebar
- `.stat-card` - Card de estatística
- `.item-card` - Card de item
- `.form-section` - Seção de formulário
- `.page-header` / `.page-title` / `.page-subtitle` - Cabeçalho de página
- `.btn-gradient` / `.btn-gradient-accent` - Botões com gradiente
- `.status-available/pending/delivered/expired` - Badges de status

---

## 📂 Estrutura de Pastas

```
src/
├── assets/              # Imagens (logos)
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── layout/          # MainLayout, Sidebar, ThemeToggle, etc.
│   ├── activity/        # Componentes do histórico
│   ├── classroom/       # Componentes de chamados
│   ├── dashboard/       # StatCard
│   ├── equipment/       # Diálogos e componentes de equipamento
│   ├── items/           # Cards, lista virtualizada, upload em massa
│   ├── lockers/         # Diálogos de escaninhos
│   ├── materials/       # Diálogos de materiais
│   ├── rooms/           # Diálogos de salas
│   ├── tasks/           # Diálogos e formulários de tarefas
│   └── users/           # Diálogos de usuários
├── contexts/            # AuthContext, ThemeContext, OfflineContext
├── data/                # mockData.ts
├── hooks/               # Custom hooks (useEquipment, useTasks, etc.)
├── integrations/supabase/ # Client e types (auto-gerados)
├── lib/                 # Utilitários (cache, PDF, sync, etc.)
├── pages/               # Páginas organizadas por módulo
│   ├── classroom/
│   ├── equipment/
│   ├── lockers/
│   ├── materials/
│   ├── rooms/
│   └── tasks/
└── types/               # TypeScript types
```

---

## 🔒 Padrão de RLS

Todas as tabelas seguem o padrão:
- **SELECT:** Usuários internos (todos os roles) podem visualizar
- **INSERT:** Usuários internos podem inserir (ou restrição por role)
- **UPDATE:** Usuários internos podem atualizar (ou role específico)
- **DELETE:** Apenas admin

Exceções:
- `classroom_calls`: INSERT público (qualquer autenticado)
- `reservations`: INSERT público, UPDATE por internos ou próprio usuário externo
- `material_requests`: Usuário pode ver/editar próprias solicitações

---

## 📡 Realtime

Usado para:
- Notificações de tarefas (`tasks` table)
- Contagem de chamados pendentes
- Notificações de materiais

---

## 🔗 Dependências Principais

```json
{
  "@supabase/supabase-js": "^2.86.2",
  "@tanstack/react-query": "^5.83.0",
  "@tanstack/react-virtual": "^3.13.16",
  "react-router-dom": "^7.1.5",
  "react-hook-form": "^7.61.1",
  "zod": "^3.25.76",
  "recharts": "^2.15.4",
  "fabric": "^6.5.1",
  "xlsx": "^0.18.5",
  "date-fns": "^3.6.0",
  "sonner": "^1.7.4",
  "lucide-react": "^0.462.0"
}
```

---

## 🚀 Rotas Completas

### Públicas
| Rota | Página |
|------|--------|
| `/admin-auth` | Login |
| `/setup` | Setup inicial (primeiro admin) |
| `/change-password` | Trocar senha |
| `/chamado-sala` | Formulário público de chamado |

### Protegidas
| Rota | Página | Restrição |
|------|--------|-----------|
| `/` | Dashboard geral | - |
| `/lost-found` | Lista de itens | - |
| `/lost-found/register` | Registro de item | - |
| `/lost-found/items` | Busca de itens | - |
| `/lost-found/items/:id` | Detalhe do item | - |
| `/lost-found/archived` | Itens arquivados | - |
| `/equipment` | Lista de equipamentos | - |
| `/equipment/register` | Cadastro de equipamento | - |
| `/equipment/edit/:id` | Edição de equipamento | - |
| `/equipment/loans` | Empréstimos | - |
| `/equipment/loan/new` | Novo empréstimo | - |
| `/equipment/reservations` | Reservas | - |
| `/rooms` | Gestão de salas | - |
| `/rooms/checklist/new` | Novo checklist | - |
| `/rooms/checklists` | Histórico de checklists | - |
| `/rooms/shift-handover/new` | Nova passagem de plantão | - |
| `/rooms/shift-handovers` | Histórico de passagens | - |
| `/lockers` | Lista de escaninhos | - |
| `/lockers/loan/new` | Nova alocação | - |
| `/lockers/loans` | Alocações | - |
| `/materials` | Gestão de solicitações | - |
| `/materials/new` | Nova solicitação | - |
| `/materials/my-requests` | Minhas solicitações | - |
| `/classroom-calls` | Chamados de sala | - |
| `/tasks` | Gestão de demandas | - |
| `/tasks/my-tasks` | Minhas demandas | - |
| `/tasks/dashboard` | Dashboard de demandas | - |
| `/reports` | Relatórios | - |
| `/activity-history` | Histórico de atividades | - |
| `/users` | Gestão de usuários | Admin |
| `/permissions` | Permissões | Admin |
| `/settings` | Configurações | - |

---

## 💾 Storage Buckets

| Bucket | Público | Uso |
|--------|---------|-----|
| `lost-items` | ✅ | Fotos de itens perdidos |

---

## ⚙️ Configurações do Sistema

Tabela `app_settings` com chave/valor (jsonb):
- Configurações gerais do sistema armazenadas como pares key-value

---

## 📝 Notas para Recriação

1. **Criar enums primeiro** (`campus_enum`, `equipment_status`, `loan_status`, `locker_status`, `app_role`)
2. **Criar tabelas na ordem** (sem dependências circulares)
3. **Configurar RLS** em todas as tabelas
4. **Criar funções auxiliares** (`has_role`, `is_admin`, etc.) antes das policies
5. **Criar bucket de storage** `lost-items` com policy pública de SELECT
6. **Deploy edge functions** com as configurações do `config.toml`
7. **Habilitar Realtime** nas tabelas necessárias (tasks, classroom_calls)
8. **Configurar auth** sem auto-confirm de email
9. **Executar setup-first-admin** para criar o primeiro administrador
