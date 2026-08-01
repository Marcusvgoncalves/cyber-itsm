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
