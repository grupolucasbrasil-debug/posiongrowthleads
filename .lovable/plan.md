## Evolução do Sistema — Admin, Kanban, Vendas, Agenda, Pacientes, Recall

Vou implementar em **5 fases**, cada uma testável separadamente. Antes de começar, preciso confirmar alguns pontos importantes.

---

### Perguntas antes de implementar

1. **Convite de usuário com senha temporária** — Para criar usuários via `supabase.auth.admin.createUser` é necessária a `SERVICE_ROLE_KEY`, que **não pode** ser usada no frontend. Vou criar uma **Edge Function** `invite-tenant-user` que recebe `{ email, role, tenant_id }`, valida que o caller é admin, cria o usuário no Auth com senha aleatória, insere em `tenant_users` e devolve a senha temporária. OK?

2. **Tabelas a usar (mantendo nomes em inglês já existentes):**
   - Leads do Kanban → tabela `clinic_leads` (já existe, por tenant) — **não** a tabela `leads` (essa é landing-page global)
   - Vendas → `sales` (já existe e populada)
   - Agendamentos → `appointments` (já existe)
   - Pacientes → `patients` (já existe)
   - Recall → `recall_campaigns` (já existe)
   
   Confirma? (O brief usou `agendamentos`/`vendas`/`pacientes`/`inquilinos` em PT mas o schema real é EN.)

3. **Campos faltantes** que vou **adicionar via migration**:
   - `tenant_users.role` (admin/sdr/medico/visualizador) + `tenant_users.active`
   - `clinic_leads`: garantir `product`, `channel`, `stage`, `lead_type`, `notes`
   - `sales`: garantir `country` (para internacional)
   - Atualizar `has_tenant_access` para considerar apenas usuários ativos

---

### Fase 1 — Banco de dados (1 migration + 1 edge function)

- Migration:
  - `ALTER TABLE tenant_users ADD COLUMN role text DEFAULT 'admin', ADD COLUMN active boolean DEFAULT true`
  - Adicionar colunas faltantes em `clinic_leads`, `sales` se necessário
  - Política RLS: admin do tenant pode gerenciar `tenant_users` do próprio tenant
- Edge Function `invite-tenant-user` (usa SERVICE_ROLE):
  - Valida JWT do caller, checa se é `admin` global ou `admin` do tenant
  - `auth.admin.createUser({ email, password: random12, email_confirm: true })`
  - Insere em `tenant_users` com `role`
  - Retorna `{ email, temp_password }`

### Fase 2 — Painel Admin: Gestão de usuários por tenant

- Em `TenantsPage.tsx`, ao clicar numa clínica → drawer/modal com aba **Usuários**
- Tabela: email, função (select inline), status (toggle ativo/inativo), ações
- Botão **+ Convidar** → modal chamando a edge function, exibe senha temporária com botão copiar

### Fase 3 — Kanban Premium (visual navy/gold + CRUD)

- Reescrever `PIPELINE_STAGES` em `src/types/admin.ts` com as 9 etapas do brief e as cores corretas (rgba navy/gold, sem neon)
- Refatorar `TenantKanban.tsx` para usar `clinic_leads` filtrando por `tenant_id`
- `KanbanColumn` + `LeadCard`: aplicar tokens visuais (bg `#0B1224`, border `rgba(255,255,255,0.07)`, hover gold)
- Botão **+ Novo Lead** → modal (Dialog) com Nome, Telefone, Produto, Canal, Tipo, Etapa, Observação
- Drag-and-drop atualiza `stage` no Supabase (já existe lógica, adaptar tabela/campos)
- Ao mover para "Fechado Ganho" → modal "Registrar valor da venda" cria registro em `sales`
- Filtros no topo: produto, canal, período, busca

### Fase 4 — Fechamentos (Sales) com formulário

- `TenantSales.tsx`: botão **+ Registrar Fechamento** abrindo modal com todos os campos do brief
- Dropdowns hardcoded com as listas de produtos/vendedores/canais fornecidas
- Tabela já existente recebe ações Editar/Excluir + rodapé com totais (Total · Nº vendas · Ticket médio)

### Fase 5 — Agenda, Pacientes, Recall

- **Agenda** (`TenantAgenda.tsx`): substituir placeholder por calendário real
  - Componente customizado com toggle Mês/Semana/Dia (mês = grid de células com badges coloridos)
  - Modal **+ Novo Agendamento** salvando em `appointments` (paciente, tipo, data, horário, duração, responsável, status, obs)
  - Cores por status: confirmado/compareceu/no-show/reagendado/cancelado
  - Quando `type='Avaliação'` + `status='compareceu'` → conta no funil do dashboard (apenas leitura no dashboard, sem trigger novo)
- **Pacientes** (`TenantPatients.tsx`): botão **+ Novo Paciente** com modal salvando em `patients`; lista já existe (vai mostrar registros criados manualmente além dos derivados de sales)
- **Recall** (`TenantRecall.tsx`): botão **+ Nova Campanha** com modal salvando em `recall_campaigns`

---

### Escopo fora desta entrega
- Trigger de "primeiro login força troca de senha" (Supabase não tem isso nativo; ficaria como item futuro — usuário troca via "Esqueci minha senha" se quiser).
- Editor de prontuário detalhado (apenas cadastro básico do paciente conforme brief).
- Recall com envio real via WhatsApp (apenas cadastro da campanha; execução já existe parcialmente em `recall_executions`).

---

**Posso prosseguir com essas 3 confirmações? (1) Edge function para convite, (2) usar tabelas EN existentes, (3) adicionar `role`/`active` em `tenant_users`.**
