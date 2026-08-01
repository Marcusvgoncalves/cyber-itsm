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

# ----------------- SEED EXECUTION -----------------
begin
  if ActiveRecord::Base.connection.table_exists?('statuses')
    seed_default_statuses
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
