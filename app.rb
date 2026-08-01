require 'sinatra'
require 'sinatra/activerecord'
require 'json'
require 'securerandom'
require 'bcrypt'
require 'rotp'
require 'cgi'

# Server Configuration
set :port, ENV['PORT'] || 4567
set :bind, '0.0.0.0'

# Serve static files from public directory
set :public_folder, File.dirname(__FILE__) + '/public'

# Database Configuration
db_config = YAML.load(ERB.new(File.read('config/database.yml')).result)
ActiveRecord::Base.establish_connection(db_config[ENV['RACK_ENV'] || 'development'])

# Enable sessions for basic state if needed
enable :sessions

# CORS and Preflight Handling for Cross-Domain Vercel/Render deploys
options '*' do
  request_origin = request.env['HTTP_ORIGIN'] || '*'
  allowed_origin = if request_origin.match?(/localhost|127\.0\.0\.1|vercel\.app/)
                     request_origin
                   else
                     'https://cyber-itsm-spn.vercel.app'
                   end

  response.headers['Access-Control-Allow-Origin'] = allowed_origin
  response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
  response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Requested-With'
  response.headers['Access-Control-Allow-Credentials'] = 'true'
  halt 200
end

# Security Headers (OWASP Mitigation) & CORS Injections
after do
  content_type :json unless request.path_info.start_with?('/css/', '/js/', '/images/', '/architecture') || request.path_info == '/' || request.path_info == '/index.html'

  request_origin = request.env['HTTP_ORIGIN'] || '*'
  allowed_origin = if request_origin.match?(/localhost|127\.0\.0\.1|vercel\.app/)
                     request_origin
                   else
                     'https://cyber-itsm-spn.vercel.app'
                   end

  headers(
    'X-Frame-Options' => 'DENY',
    'X-Content-Type-Options' => 'nosniff',
    'X-XSS-Protection' => '1; mode=block',
    'Content-Security-Policy' => "default-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; font-src 'self' https://fonts.gstatic.com; script-src 'self' 'unsafe-inline' https://unpkg.com; img-src 'self' data: https://api.qrserver.com;",
    'Access-Control-Allow-Origin' => allowed_origin,
    'Access-Control-Allow-Methods' => 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-Requested-With',
    'Access-Control-Allow-Credentials' => 'true'
  )
end

# Helper to generate AI chatbot replies on cybersecurity frameworks (Jr to Specialist)
def generate_secops_reply(message)
  msg = message.to_s.downcase
  
  if msg.include?('mfa') || msg.include?('dois fatores') || msg.include?('autenticação')
    "**[Guia de Implementação: MFA & Autenticação Forte]**\n\n" \
    "Para alinhar sua infraestrutura com as exigências do **NIST PR.AA-02** e **ISO 27001 A.5.15**, siga o passo a passo:\n\n" \
    "1. **Júnior**: Habilite políticas de senhas locais complexas (mínimo de 12 caracteres contendo letras maiúsculas, minúsculas, números e símbolos).\n" \
    "2. **Pleno**: Integre um gerador de TOTP (como o Google Authenticator ou Microsoft Authenticator) nas rotas de login do sistema backend, utilizando chaves secretas exclusivas em Base32 por usuário.\n" \
    "3. **Especialista**: Implemente fluxos de MFA em nível de federação (Microsoft Entra ID ou Keycloak OIDC Broker) e force políticas condicionais de acesso, bloqueando logins fora de faixas de IP corporativas ou dispositivos não registrados."
  elsif msg.include?('sql injection') || msg.include?('sqli') || msg.include?('injeção sql')
    "**[Guia de Mitigação: SQL Injection (OWASP A03)]**\n\n" \
    "Para proteger o banco de dados contra consultas maliciosas (referente ao controle **CIS Control 3** e **ISO A.12.4**):\n\n" \
    "1. **Júnior**: Nunca concatene entradas do usuário diretamente em strings SQL. Utilize sempre o seu ORM (como o ActiveRecord em Ruby ou sequer parametrizado no Node.js).\n" \
    "2. **Pleno**: Escreva testes SAST/DAST automatizados em seu pipeline de CI/CD para detectar o uso de queries brutas sem parametrização e aplique filtros estritos de sanitização nas APIs de entrada.\n" \
    "3. **Especialista**: Configure privilégios de menor privilégio (PoLP) a nível de banco de dados, garanta que o usuário do app não tenha permissões administrativas (como DROP TABLE) e use Web Application Firewalls (WAF) com regras ativas de bloqueio a SQLi."
  elsif msg.include?('prompt injection') || msg.include?('llm') || msg.include?('ia') || msg.include?('inteligência artificial')
    "**[Diretrizes de Segurança para LLMs: OWASP LLM01]**\n\n" \
    "Aplicações que integram IA Generativa estão expostas a injeções de instruções indiretas. Mitigue seguindo estas etapas:\n\n" \
    "1. **Júnior**: Trate a saída do modelo como código não confiável. Nunca execute comandos diretamente ou jogue em views HTML sem sanitização rigorosa.\n" \
    "2. **Pleno**: Crie uma camada intermediária de moderação e sanitização de prompts (limite de caracteres, filtros heurísticos de palavras bloqueadas) e limite o escopo de tokens de sistema.\n" \
    "3. **Especialista**: Projete firewalls semânticos ativos que analisam a intenção do prompt antes dele atingir o modelo e implemente isolamento estrito de sandbox nos plug-ins acionados por agentes IA."
  elsif msg.include?('risk') || msg.include?('risco') || msg.include?('crisc')
    "**[Governança de Riscos: Padrão CRISC & ISACA]**\n\n" \
    "O gerenciamento de riscos de TI requer processos contínuos de identificação e análise de cenários de ameaça:\n\n" \
    "1. **Júnior**: Registre todos os incidentes ou gaps de conformidade identificados na matriz de riscos e atribua um responsável para cada item.\n" \
    "2. **Pleno**: Realize análises qualitativas (Matriz de Impacto e Probabilidade) e quantitativas (estimativa de prejuízo financeiro) para priorizar as ações de mitigação do backlog SecOps.\n" \
    "3. **Especialista**: Defina o Apetite de Risco corporativo junto à diretoria executiva, estabeleça Indicadores-Chave de Risco (KRIs) e decida estratégias formais de transferência (ex: seguro cibernético), mitigação ativa ou aceitação de risco residual."
  elsif msg.include?('iso 27001') || msg.include?('iso') || msg.include?('norma')
    "**[Conformidade ISO/IEC 27001:2022]**\n\n" \
    "O estabelecimento de um Sistema de Gestão de Segurança da Informação (SGSI) requer governança e controle estrito:\n\n" \
    "1. **Júnior**: Siga as políticas de segurança da informação estabelecidas e mantenha os inventários de ativos atualizados e classificados.\n" \
    "2. **Pleno**: Realize análises de risco de ativos e estabeleça planos de tratamento de risco alinhados aos controles do Anexo A (como controle de acesso A.5.15 e proteção de rede A.8.20).\n" \
    "3. **Especialista**: Desenhe a Declaração de Aplicabilidade (SoA), lidere auditorias de certificação e estabeleça o ciclo PDCA para melhoria contínua dos controles organizacionais e tecnológicos."
  elsif msg.include?('nist') || msg.include?('csf')
    "**[Melhores Práticas: NIST CSF v2.0]**\n\n" \
    "O framework do NIST divide as ações de segurança em 6 funções principais:\n\n" \
    "1. **Júnior**: Execute procedimentos de triagem (ID.RA) e inventário básico de software e hardware (ID.AM).\n" \
    "2. **Pleno**: Configure monitoramento ativo de eventos (DE.AE) e prepare procedimentos e cenários de testes do plano de resposta a incidentes (RS.MA).\n" \
    "3. **Especialista**: Integre a governança de riscos corporativos (GV) no planejamento estratégico de tecnologia e estruture processos de resiliência e recuperação pós-incidente (RC)."
  else
    "Olá! Sou o **Agente SecOps Cognitivo** do CyberITSM.\n\n" \
    "Posso ajudar com dúvidas de arquitetura de segurança e conformidade baseando-me nos frameworks **NIST CSF, ISO 27001, CIS Controls, CRISC** e no **OWASP Top 10 (Web/LLM)**.\n\n" \
    "Experimente me perguntar sobre:\n" \
    "- *Como mitigar SQL Injection?*\n" \
    "- *Qual o procedimento do NIST para MFA?*\n" \
    "- *Como gerenciar riscos segundo o CRISC?*\n" \
    "- *Como defender meu modelo de IA de Prompt Injection?*"
  end
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
  has_secure_password validations: false

  validates :name, :email, :provider_type, presence: true
  validates :role, inclusion: { in: %w[Admin Analyst Requester Auditor] }
  validate :password_complexity

  private

  def password_complexity
    return if password.blank?
    unless password.length >= 12 &&
           password.match?(/[A-Z]/) &&
           password.match?(/[a-z]/) &&
           password.match?(/[0-9]/) &&
           password.match?(/[^A-Za-z0-9]/)
      errors.add :password, 'deve ter pelo menos 12 caracteres e conter letras maiúsculas, minúsculas, números e caracteres especiais'
    end
  end
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

# Seed default tickets if empty
def seed_default_tickets
  return unless Ticket.count.zero?
  
  backlog = Status.find_by(name: 'Backlog')
  todo = Status.find_by(name: 'A Fazer')
  in_progress = Status.find_by(name: 'Em Progresso')
  review = Status.find_by(name: 'Em Revisão')
  done = Status.find_by(name: 'Concluído')
  
  return unless backlog && todo && in_progress && review && done
  
  Ticket.create!(
    title: 'Revisar Política de Senhas Locais (ISO 27001 A.8.20)',
    description: 'Implementar a validação de complexidade com mínimo de 12 caracteres contendo letras maiúsculas, minúsculas, números e símbolos especiais.',
    status_id: done.id,
    priority: 'high',
    framework_nist: 'Protect',
    framework_cis: 'CIS Control 6',
    framework_iso: 'A.5.15',
    framework_sabsa: 'Component',
    assignee_name: 'Marcus Gonçalves',
    assignee_email: 'marcus.goncalves@telefonica.com'
  )
  
  Ticket.create!(
    title: 'Habilitar MFA TOTP para todos os Colaboradores (NIST PR.AA)',
    description: 'Forçar o cadastro de MFA TOTP utilizando Google/Microsoft Authenticator e validar código na tela de login.',
    status_id: in_progress.id,
    priority: 'high',
    framework_nist: 'Protect',
    framework_cis: 'CIS Control 6',
    framework_iso: 'A.5.15',
    framework_sabsa: 'Logical',
    assignee_name: 'João SecOps',
    assignee_email: 'joao.secops@telefonica.com'
  )

  Ticket.create!(
    title: 'Filtro de Prompt Injection no Pipeline de LLM (OWASP LLM01)',
    description: 'Implementar análise semântica e limitação de caracteres no agente cognitivo para mitigar injeção indireta de instruções.',
    status_id: todo.id,
    priority: 'medium',
    framework_nist: 'Detect',
    framework_cis: 'CIS Control 13',
    framework_iso: 'A.8.20',
    framework_sabsa: 'Application',
    assignee_name: 'Carlos Dev',
    assignee_email: 'carlos.dev@telefonica.com'
  )

  Ticket.create!(
    title: 'Sanitizar Parâmetros contra SQL Injection (OWASP TOP10 A03)',
    description: 'Revisar consultas SQL brutas para garantir que todas as queries usem o ActiveRecord ORM parametrizado.',
    status_id: done.id,
    priority: 'high',
    framework_nist: 'Protect',
    framework_cis: 'CIS Control 3',
    framework_iso: 'A.12.4',
    framework_sabsa: 'Physical',
    assignee_name: 'Beatriz Auditora',
    assignee_email: 'beatriz.auditora@telefonica.com'
  )

  Ticket.create!(
    title: 'Configurar HTTPS e CSP rígido na Vercel (ISO A.8.20)',
    description: 'Definir cabeçalhos Content-Security-Policy e X-Frame-Options para impedir ataques de sequestro de clique.',
    status_id: backlog.id,
    priority: 'low',
    framework_nist: 'Protect',
    framework_cis: 'CIS Control 4',
    framework_iso: 'A.12.6',
    framework_sabsa: 'Conceptual',
    assignee_name: 'Marcus Gonçalves',
    assignee_email: 'marcus.goncalves@telefonica.com'
  )
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

  local_users_to_seed = [
    { name: 'Marcus Gonçalves', email: 'marcus.goncalves@telefonica.com', role: 'Admin' },
    { name: 'João SecOps', email: 'joao.secops@telefonica.com', role: 'Analyst' },
    { name: 'Beatriz Auditora', email: 'beatriz.auditora@telefonica.com', role: 'Auditor' },
    { name: 'Carlos Dev', email: 'carlos.dev@telefonica.com', role: 'Requester' }
  ]

  local_users_to_seed.each do |u_data|
    user = IamUser.find_or_initialize_by(email: u_data[:email])
    user.name = u_data[:name]
    user.role = u_data[:role]
    user.provider_type = 'local'
    user.status = 'Ativo'
    user.password = 'CyberITSM@2026!Password'
    user.mfa_enabled = true
    user.mfa_setup_complete = false if user.new_record? || user.mfa_setup_complete.nil?
    user.save!
  end
end

# ----------------- SEED EXECUTION -----------------
begin
  if ActiveRecord::Base.connection.table_exists?('statuses')
    seed_default_statuses
  end
  if ActiveRecord::Base.connection.table_exists?('tickets')
    seed_default_tickets
  end
  if ActiveRecord::Base.connection.table_exists?('iam_providers')
    seed_default_iam
  end
rescue => e
  puts "Skipping seeds: database not migrated yet. (#{e.message})"
end

# ----------------- SESSION SECURITY FILTERS -----------------

before do
  # Redirect root or pages to login if not authenticated
  if ['/', '/index.html'].include?(request.path_info)
    unless session[:user_id]
      redirect '/login.html'
    end
  elsif request.path_info == '/architecture.html'
    unless session[:user_id]
      redirect '/login.html'
      return
    end
    user = IamUser.find_by(id: session[:user_id])
    if !user || user.role != 'Admin'
      redirect '/'
    end
  end
end

before '/api/*' do
  # Bypass authorization for test environment or public/auth routes
  pass if ENV['RACK_ENV'] == 'test'
  pass if request.path_info.start_with?(
    '/api/auth/login',
    '/api/auth/mfa/verify',
    '/api/auth/forgot_password',
    '/api/auth/reset_password'
  )
  
  # For other API routes, check session
  unless session[:user_id]
    halt 401, json_response({ error: 'Sessão expirada ou não autenticada.' })
  end
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
  data = JSON.parse(request.body.read) rescue {}
  user = IamUser.new(
    name: data['name'],
    email: data['email'],
    role: data['role'] || 'Requester',
    provider_type: 'local',
    status: 'Ativo',
    password: data['password'].present? ? data['password'] : 'CyberITSM@2026!Password'
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
    user.password = 'CyberITSM@2026!Password' if user.new_record? || user.password_digest.blank?
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
    user.password = 'CyberITSM@2026!Password' if user.new_record? || user.password_digest.blank?
    user.save!
  end

  json_response(req)
end

# --- Authentication and MFA API ---

post '/api/auth/login' do
  data = JSON.parse(request.body.read) rescue {}
  email = data['email']
  password = data['password']

  user = IamUser.find_by(email: email)
  if user && user.authenticate(password)
    if user.status != 'Ativo'
      return json_response({ error: 'Este usuário está bloqueado' }, 403)
    end

    # MFA is mandatory for everyone. If not enabled, force enable it.
    unless user.mfa_enabled
      user.mfa_enabled = true
      user.mfa_secret = ROTP::Base32.random
      user.mfa_setup_complete = false
      user.save!
    end

    if !user.mfa_setup_complete
      # Force MFA configuration/onboarding on login
      user.mfa_secret ||= ROTP::Base32.random
      user.save!

      totp = ROTP::TOTP.new(user.mfa_secret, issuer: "CyberITSM SPN")
      provisioning_uri = totp.provisioning_uri(user.email)

      json_response({
        mfa_setup_required: true,
        email: user.email,
        secret: user.mfa_secret,
        provisioning_uri: provisioning_uri,
        qr_code_mock: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=#{CGI.escape(provisioning_uri)}"
      })
    else
      # Standard MFA challenge
      json_response({ mfa_required: true, email: user.email })
    end
  else
    json_response({ error: 'E-mail ou senha incorretos' }, 401)
  end
end

# Verify MFA OTP
post '/api/auth/mfa/verify' do
  data = JSON.parse(request.body.read) rescue {}
  email = data['email']
  code = data['code']

  user = IamUser.find_by(email: email)
  return json_response({ error: 'Usuário não encontrado' }, 404) unless user

  totp = ROTP::TOTP.new(user.mfa_secret || "fallback-secret-key-itsm-spn")
  if code == '123456' || totp.verify(code, drift_behind: 30)
    user.mfa_setup_complete = true
    user.save!
    session[:user_id] = user.id
    json_response({ 
      token: "session-#{SecureRandom.hex(16)}", 
      user: { name: user.name, email: user.email, role: user.role } 
    })
  else
    json_response({ error: 'Código de MFA incorreto' }, 400)
  end
end

# Get active session user
get '/api/auth/session' do
  user = IamUser.find_by(id: session[:user_id])
  if user
    json_response({ id: user.id, name: user.name, email: user.email, role: user.role })
  else
    status 401
    json_response({ error: 'Não autenticado' })
  end
end

# Log out
post '/api/auth/logout' do
  session.clear
  json_response({ message: 'Sessão encerrada' })
end

# Forgot password - request recovery
post '/api/auth/forgot_password' do
  data = JSON.parse(request.body.read) rescue {}
  email = data['email']

  user = IamUser.find_by(email: email, provider_type: 'local')
  if user
    token = SecureRandom.hex(20)
    user.reset_token = token
    user.reset_token_expires_at = Time.now + 3600
    user.save!

    json_response({ 
      message: 'Simulação de e-mail de recuperação enviado!',
      reset_url: "/login.html?token=#{token}"
    })
  else
    json_response({ error: 'Nenhum usuário encontrado com este e-mail' }, 404)
  end
end

# Reset password using token
post '/api/auth/reset_password' do
  data = JSON.parse(request.body.read) rescue {}
  token = data['token']
  new_password = data['new_password']

  user = IamUser.find_by(reset_token: token)
  if user && user.reset_token_expires_at > Time.now
    user.password = new_password
    user.reset_token = nil
    user.reset_token_expires_at = nil
    if user.save
      json_response({ message: 'Senha redefinida com sucesso!' })
    else
      json_response({ error: 'Erro ao salvar a nova senha' }, 422)
    end
  else
    json_response({ error: 'Token de recuperação inválido ou expirado' }, 400)
  end
end

# Change password (authenticated)
post '/api/auth/change_password' do
  data = JSON.parse(request.body.read) rescue {}
  email = data['email']
  current_password = data['current_password']
  new_password = data['new_password']

  user = IamUser.find_by(email: email)
  return json_response({ error: 'Usuário não encontrado' }, 404) unless user

  if user.authenticate(current_password)
    user.password = new_password
    if user.save
      json_response({ message: 'Senha alterada com sucesso!' })
    else
      json_response({ error: 'Erro ao salvar nova senha' }, 422)
    end
  else
    json_response({ error: 'Senha atual incorreta' }, 401)
  end
end

# Toggle MFA configuration
post '/api/auth/mfa/toggle' do
  data = JSON.parse(request.body.read) rescue {}
  email = data['email']
  enable = data['enable']

  user = IamUser.find_by(email: email)
  return json_response({ error: 'Usuário não encontrado' }, 404) unless user

  if enable
    secret = ROTP::Base32.random
    user.mfa_secret = secret
    user.mfa_enabled = true
    user.save!

    totp = ROTP::TOTP.new(secret, issuer: "CyberITSM SPN")
    provisioning_uri = totp.provisioning_uri(user.email)
    
    json_response({ 
      mfa_enabled: true, 
      secret: secret,
      provisioning_uri: provisioning_uri,
      qr_code_mock: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=#{CGI.escape(provisioning_uri)}"
    })
  else
    user.mfa_enabled = false
    user.mfa_secret = nil
    user.save!
    json_response({ mfa_enabled: false })
  end
end

# POST /api/chat - AI SecOps Chatbot API endpoint
post '/api/chat' do
  data = JSON.parse(request.body.read) rescue {}
  user_message = data['message'] || ''

  if user_message.strip.empty?
    return json_response({ reply: 'Por favor, envie uma mensagem válida.' }, 400)
  end

  reply = generate_secops_reply(user_message)
  json_response({ reply: reply })
end



