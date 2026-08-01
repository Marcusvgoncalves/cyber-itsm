// State management
let statuses = [];
let tickets = [];
let selectedTicketId = null;

// On load
document.addEventListener('DOMContentLoaded', () => {
  fetchBoardData();
  lucide.createIcons();
});

// View Swapping
function switchView(viewName) {
  // Hide all views
  document.querySelectorAll('.view-content').forEach(el => el.style.display = 'none');
  // Deactivate all sidebar items
  document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  
  // Show selected view
  if (viewName === 'board') {
    document.getElementById('view-board').style.display = 'flex';
    document.getElementById('menu-board').classList.add('active');
    fetchBoardData();
  } else if (viewName === 'status') {
    document.getElementById('view-status').style.display = 'block';
    document.getElementById('menu-status').classList.add('active');
    fetchStatuses();
  } else if (viewName === 'c4') {
    document.getElementById('view-c4').style.display = 'flex';
    document.getElementById('menu-c4').classList.add('active');
  } else if (viewName === 'kb') {
    document.getElementById('view-kb').style.display = 'block';
    document.getElementById('menu-kb').classList.add('active');
  } else if (viewName === 'iam') {
    document.getElementById('view-iam').style.display = 'flex';
    document.getElementById('menu-iam').classList.add('active');
    fetchIamData();
  }
}

// Fetch board data (both statuses and tickets)
async function fetchBoardData() {
  const refreshIcon = document.getElementById('refresh-icon');
  if (refreshIcon) refreshIcon.classList.add('spin-animation');

  try {
    const [statusesRes, ticketsRes] = await Promise.all([
      fetch('/api/statuses'),
      fetch('/api/tickets')
    ]);

    statuses = await statusesRes.json();
    tickets = await ticketsRes.json();

    renderKanbanBoard();
  } catch (err) {
    console.error('Erro ao buscar dados do Kanban:', err);
  } finally {
    if (refreshIcon) {
      setTimeout(() => refreshIcon.classList.remove('spin-animation'), 500);
    }
  }
}

// Render Kanban board columns and cards
function renderKanbanBoard() {
  const boardEl = document.getElementById('kanban-board');
  boardEl.innerHTML = '';

  statuses.forEach(status => {
    const colEl = document.createElement('div');
    colEl.className = 'kanban-column';
    colEl.dataset.statusId = status.id;

    // Filter tickets in this status
    const columnTickets = tickets.filter(t => t.status_id === status.id);

    colEl.innerHTML = `
      <div class="column-header">
        <div class="column-title">
          <span>${escapeHTML(status.name)}</span>
          <span class="ticket-count">${columnTickets.length}</span>
        </div>
      </div>
      <div class="column-cards" ondragover="allowDrop(event)" ondrop="dropTicket(event)">
        <!-- Cards insert -->
      </div>
    `;

    const cardsContainer = colEl.querySelector('.column-cards');

    columnTickets.forEach(ticket => {
      const cardEl = document.createElement('div');
      cardEl.className = 'card';
      cardEl.draggable = true;
      cardEl.dataset.ticketId = ticket.id;
      cardEl.addEventListener('dragstart', dragTicket);
      cardEl.addEventListener('click', () => openDrawer(ticket.id));

      cardEl.innerHTML = `
        <div class="card-title">${escapeHTML(ticket.title)}</div>
        <div class="card-meta">
          <span class="card-key">${ticket.key}</span>
          <span class="badge badge-priority-${ticket.priority}">${escapeHTML(ticket.priority.toUpperCase())}</span>
        </div>
      `;

      cardsContainer.appendChild(cardEl);
    });

    boardEl.appendChild(colEl);
  });

  lucide.createIcons();
}

// --- Drag & Drop ---
let draggedTicketId = null;

function dragTicket(ev) {
  draggedTicketId = ev.currentTarget.dataset.ticketId;
  ev.dataTransfer.setData("text", draggedTicketId);
}

function allowDrop(ev) {
  ev.preventDefault();
}

async function dropTicket(ev) {
  ev.preventDefault();
  const targetCol = ev.currentTarget.closest('.kanban-column');
  if (!targetCol || !draggedTicketId) return;

  const newStatusId = parseInt(targetCol.dataset.statusId);
  const ticket = tickets.find(t => t.id == draggedTicketId);

  if (ticket && ticket.status_id !== newStatusId) {
    // Update local state temporarily
    ticket.status_id = newStatusId;
    renderKanbanBoard();

    // Call API
    try {
      await fetch(`/api/tickets/${draggedTicketId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_id: newStatusId, author: 'Analista Vivo' })
      });
      fetchBoardData(); // Re-fetch to synchronize state
    } catch (err) {
      console.error('Erro ao transicionar ticket:', err);
    }
  }
}

// --- Create Ticket Modal ---
function openCreateModal() {
  const modal = document.getElementById('create-ticket-modal');
  modal.classList.add('open');

  // Populate statuses dropdown
  const select = document.getElementById('new-ticket-status');
  select.innerHTML = '';
  statuses.forEach(status => {
    select.innerHTML += `<option value="${status.id}">${escapeHTML(status.name)}</option>`;
  });
}

function closeCreateModal() {
  document.getElementById('create-ticket-modal').classList.remove('open');
}

async function submitCreateTicket() {
  const title = document.getElementById('new-ticket-title').value;
  const description = document.getElementById('new-ticket-description').value;
  const status_id = parseInt(document.getElementById('new-ticket-status').value);
  const priority = document.getElementById('new-ticket-priority').value;
  const framework_nist = document.getElementById('new-ticket-nist').value;
  const framework_cis = document.getElementById('new-ticket-cis').value;
  const framework_iso = document.getElementById('new-ticket-iso').value;
  const framework_sabsa = document.getElementById('new-ticket-sabsa').value;
  const assignee_name = document.getElementById('new-ticket-assignee-name').value;
  const assignee_email = document.getElementById('new-ticket-assignee-email').value;

  if (!title) {
    alert('O título é obrigatório.');
    return;
  }

  try {
    const res = await fetch('/api/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, description, status_id, priority,
        framework_nist, framework_cis, framework_iso, framework_sabsa,
        assignee_name, assignee_email, author: 'Analista Vivo'
      })
    });

    if (res.ok) {
      // Clear fields
      document.getElementById('new-ticket-title').value = '';
      document.getElementById('new-ticket-description').value = '';
      document.getElementById('new-ticket-assignee-name').value = '';
      document.getElementById('new-ticket-assignee-email').value = '';
      closeCreateModal();
      fetchBoardData();
    } else {
      const errData = await res.json();
      alert('Erro: ' + (errData.errors ? errData.errors.join(', ') : 'Falha ao criar chamado'));
    }
  } catch (err) {
    console.error('Erro ao enviar chamado:', err);
  }
}

// --- Ticket Detail Drawer ---
async function openDrawer(ticketId) {
  selectedTicketId = ticketId;
  const drawer = document.getElementById('ticket-drawer');
  drawer.classList.add('open');

  try {
    const res = await fetch(`/api/tickets/${ticketId}`);
    const ticket = await res.json();

    document.getElementById('drawer-ticket-key').textContent = ticket.key;
    document.getElementById('drawer-ticket-description').value = ticket.description || '';
    
    // Status select
    const statusSelect = document.getElementById('drawer-ticket-status');
    statusSelect.innerHTML = '';
    statuses.forEach(status => {
      const selected = ticket.status_id === status.id ? 'selected' : '';
      statusSelect.innerHTML += `<option value="${status.id}" ${selected}>${escapeHTML(status.name)}</option>`;
    });

    // Other fields
    document.getElementById('drawer-ticket-priority').value = ticket.priority;
    document.getElementById('drawer-ticket-assignee').value = ticket.assignee_name || '';
    document.getElementById('drawer-ticket-nist').value = ticket.framework_nist || '';
    document.getElementById('drawer-ticket-cis').value = ticket.framework_cis || '';
    document.getElementById('drawer-ticket-iso').value = ticket.framework_iso || '';
    document.getElementById('drawer-ticket-sabsa').value = ticket.framework_sabsa || '';

    // Render Comments
    renderComments(ticket.comments);

    // Render Audits
    renderAuditLogs(ticket.audit_logs);

  } catch (err) {
    console.error('Erro ao carregar detalhes do chamado:', err);
  }
}

function closeDrawer() {
  document.getElementById('ticket-drawer').classList.remove('open');
  selectedTicketId = null;
}

// Update ticket field on change
async function updateTicketField(fieldName) {
  if (!selectedTicketId) return;

  let value;
  if (fieldName === 'description') {
    value = document.getElementById('drawer-ticket-description').value;
  } else if (fieldName === 'status_id') {
    value = parseInt(document.getElementById('drawer-ticket-status').value);
  } else if (fieldName === 'priority') {
    value = document.getElementById('drawer-ticket-priority').value;
  } else if (fieldName === 'assignee_name') {
    value = document.getElementById('drawer-ticket-assignee').value;
  } else if (fieldName === 'framework_nist') {
    value = document.getElementById('drawer-ticket-nist').value;
  } else if (fieldName === 'framework_cis') {
    value = document.getElementById('drawer-ticket-cis').value;
  } else if (fieldName === 'framework_iso') {
    value = document.getElementById('drawer-ticket-iso').value;
  } else if (fieldName === 'framework_sabsa') {
    value = document.getElementById('drawer-ticket-sabsa').value;
  }

  try {
    await fetch(`/api/tickets/${selectedTicketId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [fieldName]: value, author: 'Analista Vivo' })
    });
    
    // Refresh
    openDrawer(selectedTicketId);
    fetchBoardData();
  } catch (err) {
    console.error('Erro ao atualizar campo do ticket:', err);
  }
}

// Delete ticket
async function deleteTicket() {
  if (!selectedTicketId) return;
  if (!confirm('Deseja realmente excluir este chamado de segurança? Esta ação é irreversível e removerá todos os registros de auditoria.')) return;

  try {
    const res = await fetch(`/api/tickets/${selectedTicketId}`, { method: 'DELETE' });
    if (res.ok) {
      closeDrawer();
      fetchBoardData();
    }
  } catch (err) {
    console.error('Erro ao excluir chamado:', err);
  }
}

// Add comment
async function addComment() {
  if (!selectedTicketId) return;

  const author = document.getElementById('new-comment-author').value || 'Analista';
  const content = document.getElementById('new-comment-content').value;

  if (!content) {
    alert('Comentário não pode estar vazio.');
    return;
  }

  try {
    const res = await fetch(`/api/tickets/${selectedTicketId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content })
    });

    if (res.ok) {
      document.getElementById('new-comment-content').value = '';
      openDrawer(selectedTicketId); // refresh
    }
  } catch (err) {
    console.error('Erro ao postar comentário:', err);
  }
}

function renderComments(commentsList) {
  const container = document.getElementById('drawer-comments-list');
  container.innerHTML = '';

  if (!commentsList || commentsList.length === 0) {
    container.innerHTML = '<p style="font-size: 12px; color: var(--text-muted);">Nenhum comentário adicionado.</p>';
    return;
  }

  commentsList.forEach(comment => {
    const dateStr = new Date(comment.created_at).toLocaleString('pt-BR');
    container.innerHTML += `
      <div class="comment-item">
        <div class="comment-header">
          <span>${escapeHTML(comment.author)}</span>
          <span>${dateStr}</span>
        </div>
        <div>${escapeHTML(comment.content)}</div>
      </div>
    `;
  });
}

function renderAuditLogs(auditList) {
  const container = document.getElementById('drawer-audit-list');
  container.innerHTML = '';

  if (!auditList || auditList.length === 0) {
    container.innerHTML = '<p style="font-size: 11px; color: var(--text-muted);">Sem registros de auditoria.</p>';
    return;
  }

  auditList.forEach(log => {
    const dateStr = new Date(log.created_at).toLocaleString('pt-BR');
    container.innerHTML += `
      <div class="audit-item">
        <div><strong>${escapeHTML(log.action)}</strong> por ${escapeHTML(log.author || 'System')}</div>
        <div style="font-size: 11px; color: var(--text-secondary);">${escapeHTML(log.changes_log || '')}</div>
        <div class="audit-meta">${dateStr}</div>
      </div>
    `;
  });
}

// --- Status Manager panel ---
async function fetchStatuses() {
  try {
    const res = await fetch('/api/statuses');
    statuses = await res.json();
    renderStatusManager();
  } catch (err) {
    console.error('Erro ao buscar status:', err);
  }
}

function renderStatusManager() {
  const container = document.getElementById('status-manager-list');
  container.innerHTML = '';

  statuses.forEach((status, index) => {
    const item = document.createElement('div');
    item.className = 'status-manager-item';
    item.dataset.id = status.id;

    // Up and down ordering buttons
    const upDisabled = index === 0 ? 'disabled' : '';
    const downDisabled = index === statuses.length - 1 ? 'disabled' : '';

    item.innerHTML = `
      <div class="status-info">
        <div class="status-drag-handle">
          <i data-lucide="grip-vertical"></i>
        </div>
        <div>
          <strong style="font-size: 14px;">${escapeHTML(status.name)}</strong>
          <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">Categoria: ${status.category} | Posição: ${status.position}</div>
        </div>
      </div>
      <div class="status-actions">
        <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="moveStatus(${status.id}, -1)" ${upDisabled}>
          <i data-lucide="arrow-up" style="width: 14px; height: 14px;"></i>
        </button>
        <button class="btn btn-secondary" style="padding: 4px 8px;" onclick="moveStatus(${status.id}, 1)" ${downDisabled}>
          <i data-lucide="arrow-down" style="width: 14px; height: 14px;"></i>
        </button>
        <button class="btn btn-danger" style="padding: 4px 8px;" onclick="deleteStatus(${status.id})">
          <i data-lucide="trash-2" style="width: 14px; height: 14px;"></i>
        </button>
      </div>
    `;

    container.appendChild(item);
  });

  lucide.createIcons();
}

function openNewStatusModal() {
  document.getElementById('create-status-modal').classList.add('open');
}

function closeNewStatusModal() {
  document.getElementById('create-status-modal').classList.remove('open');
}

async function submitCreateStatus() {
  const name = document.getElementById('new-status-name').value;
  const category = document.getElementById('new-status-category').value;

  if (!name) {
    alert('O nome do status é obrigatório');
    return;
  }

  try {
    const res = await fetch('/api/statuses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category })
    });

    if (res.ok) {
      document.getElementById('new-status-name').value = '';
      closeNewStatusModal();
      fetchStatuses();
    }
  } catch (err) {
    console.error('Erro ao criar status:', err);
  }
}

async function moveStatus(statusId, direction) {
  const index = statuses.findIndex(s => s.id === statusId);
  if (index === -1) return;

  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= statuses.length) return;

  // Swap position locally
  const temp = statuses[index];
  statuses[index] = statuses[targetIndex];
  statuses[targetIndex] = temp;

  // Re-map position fields
  const orderedIds = statuses.map(s => s.id);

  try {
    await fetch('/api/statuses/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordered_ids: orderedIds })
    });
    fetchStatuses();
  } catch (err) {
    console.error('Erro ao reordenar status:', err);
  }
}

async function deleteStatus(statusId) {
  if (statuses.length <= 1) {
    alert('Não é possível excluir o único status do sistema.');
    return;
  }

  const statusObj = statuses.find(s => s.id === statusId);
  if (!statusObj) return;

  if (!confirm(`Deseja mesmo excluir o status "${statusObj.name}"? Todos os chamados associados a ele serão movidos para o primeiro status disponível.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/statuses/${statusId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchStatuses();
    } else {
      const err = await res.json();
      alert('Erro: ' + err.error);
    }
  } catch (err) {
    console.error('Erro ao excluir status:', err);
  }
}

// --- Interactive C4 Details ---
function showC4Detail(componentKey) {
  const detailPanel = document.getElementById('c4-detail-panel');
  
  const details = {
    analyst: `
      <h4>Pessoa: Analista / Arquiteto de Segurança</h4>
      <p style="margin-top: 6px; color: var(--text-secondary);">
        O papel responsável pelo gerenciamento operacional de vulnerabilidades e conformidades de arquitetura. Utiliza o Kanban do CyberITSM para abrir chamados referenciando controles regulatórios (CIS, ISO, NIST, SABSA) e movimentar o fluxo operacional.
      </p>
    `,
    frontend: `
      <h4>Contêiner: Frontend SPA (HTML5/Vanilla JS/CSS)</h4>
      <p style="margin-top: 6px; color: var(--text-secondary);">
        Uma aplicação de página única que renderiza um layout responsivo seguindo o design system <strong>Mistica da Vivo Telefônica</strong>. Comunica-se de forma assíncrona com o backend via requisições REST JSON, oferecendo drag-and-drop no quadro Kanban e painéis de configuração interativa de status.
      </p>
    `,
    backend: `
      <h4>Contêiner: Backend API (Ruby / Sinatra)</h4>
      <p style="margin-top: 6px; color: var(--text-secondary);">
        Serviço de API REST escrito em Ruby e rodando sobre o Puma Server. Valida o controle de concorrência e transições de status válidas, executa auditoria imutável gravando logs para cada ação e expõe mecanismos para testes automatizados. Mitiga riscos OWASP com cabeçalhos de segurança HTTP.
      </p>
    `,
    database: `
      <h4>Contêiner: Banco de Dados (SQLite Engine)</h4>
      <p style="margin-top: 6px; color: var(--text-secondary);">
        Banco de dados SQL em arquivo que armazena os esquemas relacionais das tabelas. Utiliza chaves estrangeiras rígidas para integridade referencial dos chamados e dos status customizáveis definidos pelo administrador.
      </p>
    `
  };

  if (details[componentKey]) {
    detailPanel.innerHTML = details[componentKey];
  }
}

// --- Utility Functions ---
function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag)
  );
}

// --- IAM (Access & Profiles Management) ---

let activeIamTab = 'providers';
let iamProviders = [];
let iamUsers = [];
let iamRequests = [];

function switchIamTab(tabName) {
  activeIamTab = tabName;
  
  // Hide all sub-tab contents
  document.querySelectorAll('.iam-tab-content').forEach(el => el.style.display = 'none');
  
  // Deactivate all tab buttons
  document.getElementById('tab-iam-providers').classList.remove('btn-active-tab');
  document.getElementById('tab-iam-users').classList.remove('btn-active-tab');
  document.getElementById('tab-iam-governance').classList.remove('btn-active-tab');
  
  // Show target tab content
  if (tabName === 'providers') {
    document.getElementById('iam-content-providers').style.display = 'block';
    document.getElementById('tab-iam-providers').classList.add('btn-active-tab');
    renderIamProviders();
  } else if (tabName === 'users') {
    document.getElementById('iam-content-users').style.display = 'block';
    document.getElementById('tab-iam-users').classList.add('btn-active-tab');
    renderIamUsers();
  } else if (tabName === 'governance') {
    document.getElementById('iam-content-governance').style.display = 'block';
    document.getElementById('tab-iam-governance').classList.add('btn-active-tab');
    renderIamGovernance();
  }
}

async function fetchIamData() {
  try {
    const [providersRes, usersRes, requestsRes] = await Promise.all([
      fetch('/api/iam/providers'),
      fetch('/api/iam/users'),
      fetch('/api/iam/requests')
    ]);
    
    iamProviders = await providersRes.json();
    iamUsers = await usersRes.json();
    iamRequests = await requestsRes.json();
    
    switchIamTab(activeIamTab);
  } catch (err) {
    console.error('Erro ao buscar dados IAM:', err);
  }
}

function renderIamProviders() {
  const container = document.getElementById('iam-providers-list');
  container.innerHTML = '';
  
  iamProviders.forEach(provider => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-secondary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius-md)';
    card.style.padding = '16px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '12px';
    
    const settingsObj = JSON.parse(provider.settings || '{}');
    let settingsHTML = '';
    
    for (const [k, v] of Object.entries(settingsObj)) {
      settingsHTML += `
        <div style="font-size: 11px; display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary); text-transform: uppercase;">${k.replace('_', ' ')}:</span>
          <span style="font-weight: 500;">${escapeHTML(v)}</span>
        </div>
      `;
    }
    
    const activeText = provider.active ? 'Ativo (Conectado)' : 'Inativo';
    const activeBadgeColor = provider.active ? 'var(--color-done)' : 'var(--text-muted)';
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h4 style="font-size: 14px; font-weight: 600;">${escapeHTML(provider.name)}</h4>
          <span style="font-size: 10px; color: var(--text-muted); text-transform: uppercase;">Tipo ID: ${provider.provider_type}</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="badge" style="background: rgba(0,0,0,0.2); color: ${activeBadgeColor}; border: 1px solid ${activeBadgeColor}; font-size: 9px; padding: 1px 6px;">${activeText}</span>
          <input type="checkbox" ${provider.active ? 'checked' : ''} onchange="toggleProviderActive(${provider.id}, this.checked)" style="cursor: pointer;">
        </div>
      </div>
      
      <div style="background: var(--bg-tertiary); padding: 8px 12px; border-radius: var(--border-radius-sm); display: flex; flex-direction: column; gap: 4px;">
        <div style="font-size: 11px; display: flex; justify-content: space-between;">
          <span style="color: var(--text-secondary);">CLIENT ID:</span>
          <span>${escapeHTML(provider.client_id || 'Não configurado')}</span>
        </div>
        ${settingsHTML}
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: auto; padding-top: 8px;">
        <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="openConfigProviderModal(${provider.id})">Configurar</button>
      </div>
    `;
    
    container.appendChild(card);
  });
}

function renderIamUsers() {
  const tbody = document.getElementById('iam-users-table-body');
  tbody.innerHTML = '';
  
  if (iamUsers.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">Nenhum usuário sincronizado. Ative um provedor e clique em Sincronizar Identidades.</td>
      </tr>
    `;
    return;
  }
  
  iamUsers.forEach(user => {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border-color)';
    tr.style.transition = 'var(--transition-smooth)';
    
    const statusText = user.status || 'Ativo';
    const statusBadgeClass = statusText === 'Ativo' ? 'badge-priority-low' : 'badge-priority-critical';
    
    tr.innerHTML = `
      <td style="padding: 10px 8px; font-weight: 500;">${escapeHTML(user.name)}</td>
      <td style="padding: 10px 8px; color: var(--text-secondary);">${escapeHTML(user.email)}</td>
      <td style="padding: 10px 8px; text-transform: uppercase; font-size: 11px; font-weight: 600; color: var(--color-accent);">${escapeHTML(user.provider_type)}</td>
      <td style="padding: 10px 8px;">
        <select class="form-control" onchange="changeUserRole(${user.id}, this.value)" style="padding: 4px 8px; font-size: 12px; width: fit-content; background: var(--bg-tertiary);">
          <option value="Admin" ${user.role === 'Admin' ? 'selected' : ''}>Admin</option>
          <option value="Analyst" ${user.role === 'Analyst' ? 'selected' : ''}>Analyst</option>
          <option value="Requester" ${user.role === 'Requester' ? 'selected' : ''}>Requester</option>
          <option value="Auditor" ${user.role === 'Auditor' ? 'selected' : ''}>Auditor</option>
        </select>
      </td>
      <td style="padding: 10px 8px;">
        <span class="badge ${statusBadgeClass}">${statusText}</span>
      </td>
      <td style="padding: 10px 8px; text-align: right;">
        <div style="display: inline-flex; gap: 8px;">
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;" onclick="toggleUserStatus(${user.id})">
            ${statusText === 'Ativo' ? 'Bloquear' : 'Desbloquear'}
          </button>
          <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px; color: var(--color-critical);" onclick="deleteUser(${user.id})">
            Desprovisionar
          </button>
        </div>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
}

function renderIamGovernance() {
  const container = document.getElementById('iga-requests-list');
  container.innerHTML = '';
  
  if (iamRequests.length === 0) {
    container.innerHTML = '<p style="font-size: 12px; color: var(--text-muted); text-align: center; padding: 24px;">Nenhuma solicitação no log de governança.</p>';
    return;
  }
  
  iamRequests.forEach(req => {
    const card = document.createElement('div');
    card.style.background = 'var(--bg-tertiary)';
    card.style.border = '1px solid var(--border-color)';
    card.style.borderRadius = 'var(--border-radius-sm)';
    card.style.padding = '12px';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';
    card.style.gap = '8px';
    
    const dateStr = new Date(req.created_at).toLocaleString('pt-BR');
    const isPending = req.status === 'Pendente';
    const statusColor = req.status === 'Provisionado' ? 'var(--color-done)' : 'var(--color-accent)';
    
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong style="font-size: 13px;">${escapeHTML(req.user_name)}</strong>
          <span style="font-size: 11px; color: var(--text-secondary);"> (${escapeHTML(req.user_email)})</span>
        </div>
        <span class="badge" style="background: rgba(0,0,0,0.3); border: 1px solid ${statusColor}; color: ${statusColor}; font-size: 10px;">
          ${req.status}
        </span>
      </div>
      
      <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4;">
        Solicitado perfil <span style="color: var(--text-primary); font-weight: 600;">${req.requested_role}</span> via governança.
        <div style="font-size: 11px; font-style: italic; color: var(--text-muted); margin-top: 4px;">Log: ${escapeHTML(req.log)}</div>
      </div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--border-color);">
        <span style="font-size: 10px; color: var(--text-muted);">${dateStr}</span>
        ${isPending ? `
          <button class="btn btn-primary" style="padding: 2px 10px; font-size: 11px;" onclick="approveGovernanceRequest(${req.id})">
            Aprovar e Provisionar
          </button>
        ` : `
          <span style="font-size: 10px; color: var(--text-muted);">Aprovado por: ${escapeHTML(req.approver)}</span>
        `}
      </div>
    `;
    
    container.appendChild(card);
  });
}

// Toggle Provider Active Status
async function toggleProviderActive(providerId, active) {
  try {
    const res = await fetch(`/api/iam/providers/${providerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active })
    });
    
    if (res.ok) {
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao alternar provedor:', err);
  }
}

// Config Provider
async function openConfigProviderModal(providerId) {
  const provider = iamProviders.find(p => p.id === providerId);
  if (!provider) return;
  
  const client_id = prompt('Configurar CLIENT ID:', provider.client_id || '');
  if (client_id === null) return;
  
  const client_secret = prompt('Configurar CLIENT SECRET:', provider.client_secret || '');
  if (client_secret === null) return;

  try {
    const res = await fetch(`/api/iam/providers/${providerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id, client_secret })
    });
    
    if (res.ok) {
      alert('Configuração salva com sucesso!');
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao configurar provedor:', err);
  }
}

// Run sync
async function runSimulationSync() {
  const active = iamProviders.find(p => p.active);
  if (!active) {
    alert('Ative um Provedor IAM antes de executar a sincronização.');
    return;
  }
  
  try {
    const res = await fetch('/api/iam/sync', { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      alert(data.message);
      fetchIamData();
    } else {
      const data = await res.json();
      alert('Erro: ' + data.error);
    }
  } catch (err) {
    console.error('Erro na sincronização:', err);
  }
}

// Toggle status
async function toggleUserStatus(userId) {
  try {
    const res = await fetch(`/api/iam/users/${userId}/toggle_status`, { method: 'POST' });
    if (res.ok) {
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao alternar status do usuário:', err);
  }
}

// Change role
async function changeUserRole(userId, role) {
  try {
    const res = await fetch(`/api/iam/users/${userId}/change_role`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role })
    });
    if (res.ok) {
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao alterar perfil do usuário:', err);
  }
}

// Delete user
async function deleteUser(userId) {
  if (!confirm('Tem certeza de que deseja desprovisionar este usuário da base corporativa?')) return;
  try {
    const res = await fetch(`/api/iam/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao desprovisionar usuário:', err);
  }
}

// Submit Governance request
async function submitGovernanceRequest() {
  const name = document.getElementById('iga-req-name').value;
  const email = document.getElementById('iga-req-email').value;
  const requested_role = document.getElementById('iga-req-role').value;
  
  if (!name || !email) {
    alert('Preencha o Nome e o E-mail do colaborador.');
    return;
  }
  
  try {
    const res = await fetch('/api/iam/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_name: name, user_email: email, requested_role })
    });
    
    if (res.ok) {
      document.getElementById('iga-req-name').value = '';
      document.getElementById('iga-req-email').value = '';
      alert('Solicitação de acesso enviada para aprovação do gestor de SecOps (simulado Sailpoint).');
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao enviar solicitação:', err);
  }
}

// Approve Governance Request
async function approveGovernanceRequest(requestId) {
  const approver = prompt('Nome do Aprovador (ex: Gestor de Segurança):', 'Aprovador SecOps');
  if (!approver) return;
  
  try {
    const res = await fetch(`/api/iam/requests/${requestId}/approve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approver })
    });
    
    if (res.ok) {
      alert('Aprovado! Provisionamento efetuado com sucesso.');
      fetchIamData();
    }
  } catch (err) {
    console.error('Erro ao aprovar solicitação:', err);
  }
}

// Open manual user creation modal
function openCreateUserModal() {
  document.getElementById('create-user-modal').classList.add('open');
}

// Close manual user creation modal
function closeCreateUserModal() {
  document.getElementById('create-user-modal').classList.remove('open');
  document.getElementById('manual-user-name').value = '';
  document.getElementById('manual-user-email').value = '';
}

// Submit manual user creation
async function submitCreateUserManual() {
  const name = document.getElementById('manual-user-name').value;
  const email = document.getElementById('manual-user-email').value;
  const role = document.getElementById('manual-user-role').value;

  if (!name || !email) {
    alert('Preencha o Nome e o E-mail.');
    return;
  }

  try {
    const res = await fetch('/api/iam/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, role })
    });

    if (res.ok) {
      closeCreateUserModal();
      alert('Usuário criado manualmente com sucesso na base de dados local!');
      fetchIamData();
    } else {
      const data = await res.json();
      alert('Erro: ' + (data.errors ? data.errors.join(', ') : 'Falha ao criar usuário'));
    }
  } catch (err) {
    console.error('Erro ao criar usuário manualmente:', err);
  }
}


