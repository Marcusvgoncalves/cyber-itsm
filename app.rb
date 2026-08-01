require 'sinatra'
require 'sinatra/activerecord'
require 'json'

# Serve static files from public directory
set :public_folder, File.dirname(__FILE__) + '/public'

# Database Configuration
db_config = YAML.load(ERB.new(File.read('config/database.yml')).result)
ActiveRecord::Base.establish_connection(db_config[ENV['RACK_ENV'] || 'development'])

# Enable sessions for basic state if needed
enable :sessions

# Security Headers (OWASP Mitigation)
after do
  content_type :json unless request.path_info.start_with?('/css/', '/js/', '/images/', '/architecture') || request.path_info == '/' || request.path_info == '/index.html'

  headers(
    'X-Frame-Options' => 'DENY',
    'X-Content-Type-Options' => 'nosniff',
    'X-XSS-Protection' => '1; mode=block',
    'Content-Security-Policy' => "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; img-src 'self' data:;"
  )
end

# ----------------- MODELS -----------------

class Status < ActiveRecord::Base
  has_many :tickets
  validates :name, presence: true
  validates :category, inclusion: { in: %w[todo in_progress done] }
end

class Ticket < ActiveRecord::Base
  belongs_to :status
  has_many :comments, dependent: :destroy
  has_many :audit_logs, dependent: :destroy

  validates :title, presence: true

  before_create :generate_key

  private

  def generate_key
    last_ticket = Ticket.order(:id).last
    num = last_ticket ? last_ticket.key.split('-').last.to_i + 1 : 1001
    self.key = "SEC-#{num}"
  end
end

class Comment < ActiveRecord::Base
  belongs_to :ticket
  validates :author, :content, presence: true
end

class AuditLog < ActiveRecord::Base
  belongs_to :ticket
  validates :action, presence: true
end

class IamProvider < ActiveRecord::Base
  validates :name, :provider_type, presence: true
end

class IamUser < ActiveRecord::Base
  validates :name, :email, :provider_type, presence: true
  validates :role, inclusion: { in: %w[Admin Analyst Requester Auditor] }
end

class IdentityRequest < ActiveRecord::Base
  validates :user_name, :user_email, :requested_role, presence: true
  validates :status, inclusion: { in: %w[Pendente Aprovado Provisionado] }
end

# Helper for JSON responses
def json_response(data, status_code = 200)
  status status_code
  data.to_json
end

# Seed default statuses if empty
def seed_default_statuses
  if Status.count.zero?
    Status.create!(name: 'Backlog', position: 1, category: 'todo')
    Status.create!(name: 'A Fazer', position: 2, category: 'todo')
    Status.create!(name: 'Em Progresso', position: 3, category: 'in_progress')
    Status.create!(name: 'Em Revisão', position: 4, category: 'in_progress')
    Status.create!(name: 'Concluído', position: 5, category: 'done')
  end
end

# Seed default IAM providers and users if empty
def seed_default_iam
  if IamProvider.count.zero?
    IamProvider.create!(
      name: 'Microsoft Entra ID (Azure AD)',
      provider_type: 'entraid',
      client_id: 'entra-client-9988',
      client_secret: 'sec-entra-3321',
      settings: { tenant_id: 'common-vivo-tenant', scopes: 'openid profile email' }.to_json,
      active: true
    )
    IamProvider.create!(
      name: 'Keycloak OIDC Broker',
      provider_type: 'keycloak',
      client_id: 'cyber-itsm-app',
      client_secret: 'keycloak-client-secret-123',
      settings: { auth_server_url: 'https://keycloak.telefonica.com/auth', realm: 'VivoRealm' }.to_json,
      active: false
    )
    IamProvider.create!(
      name: 'Oracle Access Manager (OAM)',
      provider_type: 'oam',
      client_id: 'oam-webgate-itsm',
      client_secret: 'oam-pass-gate-889',
      settings: { webgate_id: 'WG_CYBER_ITSM', header_username: 'OAM_REMOTE_USER' }.to_json,
      active: false
    )
    IamProvider.create!(
      name: 'Sailpoint IdentityNow (IGA)',
      provider_type: 'sailpoint',
      client_id: 'sailpoint-governance-itsm',
      client_secret: 'sp-secret-442299',
      settings: { api_endpoint: 'https://sailpoint.vivo.com/identitynow/api', sync_cron: '0 0 * * *' }.to_json,
      active: false
    )
  end

  if IamUser.count.zero?
    IamUser.create!(name: 'Marcus Gonçalves', email: 'marcus.goncalves@telefonica.com', role: 'Admin', provider_type: 'keycloak', status: 'Ativo')
    IamUser.create!(name: 'João SecOps', email: 'joao.secops@telefonica.com', role: 'Analyst', provider_type: 'entraid', status: 'Ativo')
    IamUser.create!(name: 'Beatriz Auditora', email: 'beatriz.auditora@telefonica.com', role: 'Auditor', provider_type: 'sailpoint', status: 'Ativo')
    IamUser.create!(name: 'Carlos Dev', email: 'carlos.dev@telefonica.com', role: 'Requester', provider_type: 'oam', status: 'Ativo')
  end
end

# ----------------- SEED EXECUTION -----------------
begin
  if ActiveRecord::Base.connection.table_exists?('statuses')
    seed_default_statuses
  end
  if ActiveRecord::Base.connection.table_exists?('iam_providers')
    seed_default_iam
  end
rescue => e
  puts "Skipping seeds: database not migrated yet. (#{e.message})"
end

# ----------------- API ROUTES -----------------

# Serve the Frontend main page
get '/' do
  send_file File.join(settings.public_folder, 'index.html')
end

# --- Statuses API ---

# Get all statuses
get '/api/statuses' do
  statuses = Status.order(:position).all
  json_response(statuses)
end

# Create a new status
post '/api/statuses' do
  data = JSON.parse(request.body.read)
  # Calculate position
  max_pos = Status.maximum(:position) || 0
  status_obj = Status.new(
    name: data['name'],
    category: data['category'] || 'todo',
    position: max_pos + 1
  )

  if status_obj.save
    json_response(status_obj, 201)
  else
    json_response({ errors: status_obj.errors.full_messages }, 422)
  end
end

# Update status
put '/api/statuses/:id' do
  status_obj = Status.find_by(id: params[:id])
  return json_response({ error: 'Status não encontrado' }, 404) unless status_obj

  data = JSON.parse(request.body.read)
  status_obj.name = data['name'] if data.key?('name')
  status_obj.category = data['category'] if data.key?('category')
  status_obj.position = data['position'] if data.key?('position')

  if status_obj.save
    json_response(status_obj)
  else
    json_response({ errors: status_obj.errors.full_messages }, 422)
  end
end

# Delete status
delete '/api/statuses/:id' do
  status_obj = Status.find_by(id: params[:id])
  return json_response({ error: 'Status não encontrado' }, 404) unless status_obj

  # Fallback status to move tickets to
  fallback = Status.where.not(id: status_obj.id).order(:position).first
  unless fallback
    return json_response({ error: 'Não é possível excluir o único status do sistema' }, 400)
  end

  ActiveRecord::Base.transaction do
    # Move tickets to fallback status
    status_obj.tickets.update_all(status_id: fallback.id)
    status_obj.destroy
  end

  json_response({ message: 'Status excluído com sucesso e chamados movidos', fallback_id: fallback.id })
end

# Reorder statuses
post '/api/statuses/reorder' do
  data = JSON.parse(request.body.read)
  ordered_ids = data['ordered_ids'] # Array of IDs in order

  ActiveRecord::Base.transaction do
    ordered_ids.each_with_index do |id, index|
      Status.where(id: id).update_all(position: index + 1)
    end
  end

  json_response({ message: 'Status reordenados com sucesso' })
end


# --- Tickets API ---

# Get all tickets
get '/api/tickets' do
  tickets = Ticket.all.map do |t|
    t.attributes.merge(
      'status_name' => t.status&.name,
      'status_category' => t.status&.category
    )
  end
  json_response(tickets)
end

# Get single ticket detail
get '/api/tickets/:id' do
  ticket = Ticket.find_by(id: params[:id])
  return json_response({ error: 'Chamado não encontrado' }, 404) unless ticket

  json_response(
    ticket.attributes.merge(
      'status_name' => ticket.status&.name,
      'status_category' => ticket.status&.category,
      'comments' => ticket.comments.order(created_at: :desc).as_json,
      'audit_logs' => ticket.audit_logs.order(created_at: :desc).as_json
    )
  )
end

# Create a ticket
post '/api/tickets' do
  data = JSON.parse(request.body.read)
  
  # Default status if not provided
  status_id = data['status_id'] || Status.order(:position).first&.id
  unless status_id
    return json_response({ error: 'Nenhum status configurado no sistema' }, 400)
  end

  ticket = Ticket.new(
    title: data['title'],
    description: data['description'],
    status_id: status_id,
    priority: data['priority'] || 'medium',
    framework_nist: data['framework_nist'],
    framework_cis: data['framework_cis'],
    framework_iso: data['framework_iso'],
    framework_sabsa: data['framework_sabsa'],
    assignee_name: data['assignee_name'] || 'Sem atribuição',
    assignee_email: data['assignee_email']
  )

  if ticket.save
    # Audit log
    AuditLog.create!(
      ticket: ticket,
      action: 'Criado',
      changes_log: "Chamado criado com prioridade #{ticket.priority} no status #{ticket.status.name}",
      author: data['author'] || 'System'
    )
    json_response(ticket, 201)
  else
    json_response({ errors: ticket.errors.full_messages }, 422)
  end
end

# Update a ticket (e.g. status transition)
put '/api/tickets/:id' do
  ticket = Ticket.find_by(id: params[:id])
  return json_response({ error: 'Chamado não encontrado' }, 404) unless ticket

  data = JSON.parse(request.body.read)
  
  changes = []
  
  if data.key?('status_id') && data['status_id'] != ticket.status_id
    old_status = ticket.status.name
    new_status = Status.find_by(id: data['status_id'])&.name
    changes << "Status alterado de '#{old_status}' para '#{new_status}'"
    ticket.status_id = data['status_id']
  end

  if data.key?('title') && data['title'] != ticket.title
    changes << "Título alterado de '#{ticket.title}' para '#{data['title']}'"
    ticket.title = data['title']
  end

  if data.key?('description') && data['description'] != ticket.description
    changes << "Descrição alterada"
    ticket.description = data['description']
  end

  if data.key?('priority') && data['priority'] != ticket.priority
    changes << "Prioridade alterada de '#{ticket.priority}' para '#{data['priority']}'"
    ticket.priority = data['priority']
  end

  if data.key?('assignee_name') && data['assignee_name'] != ticket.assignee_name
    changes << "Responsável alterado de '#{ticket.assignee_name}' para '#{data['assignee_name']}'"
    ticket.assignee_name = data['assignee_name']
    ticket.assignee_email = data['assignee_email']
  end

  # Framework fields
  %w[framework_nist framework_cis framework_iso framework_sabsa].each do |field|
    if data.key?(field) && data[field] != ticket.send(field)
      changes << "#{field.upcase} alterado de '#{ticket.send(field)}' para '#{data[field]}'"
      ticket.send("#{field}=", data[field])
    end
  end

  if ticket.save
    if changes.any?
      AuditLog.create!(
        ticket: ticket,
        action: 'Atualizado',
        changes_log: changes.join(', '),
        author: data['author'] || 'System'
      )
    end
    json_response(ticket)
  else
    json_response({ errors: ticket.errors.full_messages }, 422)
  end
end

# Delete a ticket
delete '/api/tickets/:id' do
  ticket = Ticket.find_by(id: params[:id])
  return json_response({ error: 'Chamado não encontrado' }, 404) unless ticket

  ticket.destroy
  json_response({ message: 'Chamado excluído com sucesso' })
end


# --- Comments API ---

# Get comments for a ticket
get '/api/tickets/:ticket_id/comments' do
  ticket = Ticket.find_by(id: params[:ticket_id])
  return json_response({ error: 'Chamado não encontrado' }, 404) unless ticket

  json_response(ticket.comments.order(created_at: :desc))
end

# Create a comment
post '/api/tickets/:ticket_id/comments' do
  ticket = Ticket.find_by(id: params[:ticket_id])
  return json_response({ error: 'Chamado não encontrado' }, 404) unless ticket

  data = JSON.parse(request.body.read)
  comment = Comment.new(
    ticket: ticket,
    author: data['author'] || 'Anônimo',
    content: data['content']
  )

  if comment.save
    # Audit log
    AuditLog.create!(
      ticket: ticket,
      action: 'Comentado',
      changes_log: "Novo comentário adicionado por #{comment.author}",
      author: comment.author
    )
    json_response(comment, 201)
  else
    json_response({ errors: comment.errors.full_messages }, 422)
  end
end


# --- IAM API ---

# Get all IAM providers
get '/api/iam/providers' do
  providers = IamProvider.all
  json_response(providers)
end

# Update IAM provider configurations
put '/api/iam/providers/:id' do
  provider = IamProvider.find_by(id: params[:id])
  return json_response({ error: 'Provedor não encontrado' }, 404) unless provider

  data = JSON.parse(request.body.read)
  provider.client_id = data['client_id'] if data.key?('client_id')
  provider.client_secret = data['client_secret'] if data.key?('client_secret')
  provider.active = data['active'] if data.key?('active')
  if data.key?('settings')
    provider.settings = data['settings'].is_a?(String) ? data['settings'] : data['settings'].to_json
  end

  # Deactivate other providers if this one is activated
  if provider.active
    IamProvider.where.not(id: provider.id).update_all(active: false)
  end

  if provider.save
    json_response(provider)
  else
    json_response({ errors: provider.errors.full_messages }, 422)
  end
end

# Get all IAM synchronized users
get '/api/iam/users' do
  users = IamUser.all
  json_response(users)
end

# Create user manually
post '/api/iam/users' do
  data = JSON.parse(request.body.read)
  user = IamUser.new(
    name: data['name'],
    email: data['email'],
    role: data['role'] || 'Requester',
    provider_type: 'local',
    status: 'Ativo'
  )

  if user.save
    json_response(user, 201)
  else
    json_response({ errors: user.errors.full_messages }, 422)
  end
end


# Toggle user status (Ativo / Bloqueado)
post '/api/iam/users/:id/toggle_status' do
  user = IamUser.find_by(id: params[:id])
  return json_response({ error: 'Usuário não encontrado' }, 404) unless user

  user.status = (user.status == 'Ativo' ? 'Bloqueado' : 'Ativo')
  if user.save
    json_response(user)
  else
    json_response({ errors: user.errors.full_messages }, 422)
  end
end

# Edit user profile/role
post '/api/iam/users/:id/change_role' do
  user = IamUser.find_by(id: params[:id])
  return json_response({ error: 'Usuário não encontrado' }, 404) unless user

  data = JSON.parse(request.body.read)
  user.role = data['role']
  
  if user.save
    json_response(user)
  else
    json_response({ errors: user.errors.full_messages }, 422)
  end
end

# Delete/Deprovision user
delete '/api/iam/users/:id' do
  user = IamUser.find_by(id: params[:id])
  return json_response({ error: 'Usuário não encontrado' }, 404) unless user

  user.destroy
  json_response({ message: 'Usuário desprovisionado com sucesso' })
end

# Simulate Identity Synchronization from active provider
post '/api/iam/sync' do
  active_provider = IamProvider.find_by(active: true)
  unless active_provider
    return json_response({ error: 'Nenhum provedor ativo para sincronização' }, 400)
  end

  mock_users_by_provider = {
    'entraid' => [
      { name: 'Ana EntraID', email: 'ana.entraid@telefonica.com', role: 'Analyst' },
      { name: 'Bernardo EntraID', email: 'bernardo.entraid@telefonica.com', role: 'Requester' }
    ],
    'keycloak' => [
      { name: 'Kelly Keycloak', email: 'kelly.keycloak@telefonica.com', role: 'Admin' },
      { name: 'Kevin Keycloak', email: 'kevin.keycloak@telefonica.com', role: 'Analyst' }
    ],
    'oam' => [
      { name: 'Oscar Oam', email: 'oscar.oam@telefonica.com', role: 'Requester' },
      { name: 'Olivia Oam', email: 'olivia.oam@telefonica.com', role: 'Auditor' }
    ],
    'sailpoint' => [
      { name: 'Sam Sailpoint', email: 'sam.sailpoint@telefonica.com', role: 'Auditor' },
      { name: 'Sarah Sailpoint', email: 'sarah.sailpoint@telefonica.com', role: 'Analyst' }
    ]
  }

  imported = []
  users_data = mock_users_by_provider[active_provider.provider_type] || []

  users_data.each do |u|
    user = IamUser.find_or_initialize_by(email: u[:email])
    user.name = u[:name]
    user.role = u[:role]
    user.provider_type = active_provider.provider_type
    user.status = 'Ativo'
    user.save!
    imported << user
  end

  json_response({ message: "Sincronização concluída para o provedor #{active_provider.name}!", users: imported })
end

# Get all governance/provisioning requests (Sailpoint model)
get '/api/iam/requests' do
  requests = IdentityRequest.all.order(created_at: :desc)
  json_response(requests)
end

# Submit a governance access request
post '/api/iam/requests' do
  data = JSON.parse(request.body.read)
  
  req = IdentityRequest.new(
    user_name: data['user_name'],
    user_email: data['user_email'],
    requested_role: data['requested_role'],
    action_type: data['action_type'] || 'RoleChange',
    status: 'Pendente',
    log: "Requisição de governança aberta para alterar perfil para #{data['requested_role']}"
  )

  if req.save
    json_response(req, 201)
  else
    json_response({ errors: req.errors.full_messages }, 422)
  end
end

# Approve and provision a governance request
put '/api/iam/requests/:id/approve' do
  req = IdentityRequest.find_by(id: params[:id])
  return json_response({ error: 'Requisição não encontrada' }, 404) unless req

  data = JSON.parse(request.body.read)
  approver = data['approver'] || 'Gestor SecOps'

  ActiveRecord::Base.transaction do
    req.status = 'Provisionado'
    req.approver = approver
    req.log = "Aprovado por #{approver}. Provisionamento executado com sucesso no conector de destino."
    req.save!

    # Update or create the actual user role in local database (Sailpoint provisioning action)
    user = IamUser.find_or_initialize_by(email: req.user_email)
    user.name = req.user_name
    user.role = req.requested_role
    user.provider_type = 'sailpoint' # Governed by Sailpoint
    user.status = 'Ativo'
    user.save!
  end

  json_response(req)
end
