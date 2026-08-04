require_relative 'spec_helper'

RSpec.describe 'CyberITSM REST API' do
  let(:json_headers) { { 'CONTENT_TYPE' => 'application/json' } }

  describe 'Security Headers' do
    it 'includes rigid security headers in responses' do
      get '/'
      expect(last_response.headers['X-Frame-Options']).to eq('DENY')
      expect(last_response.headers['X-Content-Type-Options']).to eq('nosniff')
      expect(last_response.headers['Content-Security-Policy']).to include("default-src 'self'")
    end
  end

  describe 'Statuses API' do
    it 'lists all default statuses' do
      get '/api/statuses'
      expect(last_response.status).to eq(200)
      res = JSON.parse(last_response.body)
      expect(res.size).to eq(5)
      expect(res.map { |s| s['name'] }).to include('Backlog', 'Concluído')
    end

    it 'creates a new status' do
      payload = { name: 'Aguardando Validação', category: 'in_progress' }
      post '/api/statuses', payload.to_json, json_headers
      expect(last_response.status).to eq(201)
      res = JSON.parse(last_response.body)
      expect(res['name']).to eq('Aguardando Validação')
      expect(res['position']).to eq(6)
    end

    it 'updates an existing status' do
      status_obj = Status.find_by(name: 'A Fazer')
      payload = { name: 'A Fazer Urgente', category: 'todo' }
      put "/api/statuses/#{status_obj.id}", payload.to_json, json_headers
      expect(last_response.status).to eq(200)
      expect(status_obj.reload.name).to eq('A Fazer Urgente')
    end

    it 'deletes a status and moves tickets to fallback status' do
      status_to_del = Status.find_by(name: 'Em Revisão')
      fallback = Status.find_by(name: 'Backlog')
      
      # Create a ticket in status to delete
      ticket = Ticket.create!(
        title: 'MFA Vulnerability',
        status_id: status_to_del.id,
        priority: 'high'
      )

      delete "/api/statuses/#{status_to_del.id}"
      expect(last_response.status).to eq(200)
      
      # Status should be deleted
      expect(Status.find_by(id: status_to_del.id)).to be_nil
      # Ticket should be moved to fallback status
      expect(ticket.reload.status_id).to eq(fallback.id)
    end
  end

  describe 'Tickets API' do
    it 'creates a new ticket with automatic key assignment and audit log' do
      status_obj = Status.find_by(name: 'Backlog')
      payload = {
        title: 'Corrigir CSP bloqueando scripts da Vivo',
        description: 'CSP atual bloqueia scripts legítimos do design system Mistica',
        status_id: status_obj.id,
        priority: 'high',
        framework_nist: 'Protect',
        framework_cis: 'CIS Control 4',
        assignee_name: 'Marcus Gonçalves',
        author: 'Arquiteto Seg'
      }

      post '/api/tickets', payload.to_json, json_headers
      expect(last_response.status).to eq(201)
      res = JSON.parse(last_response.body)
      
      expect(res['key']).to eq('SEC-1001')
      expect(res['title']).to eq('Corrigir CSP bloqueando scripts da Vivo')
      
      # Assert audit log was generated
      ticket_id = res['id']
      audit = AuditLog.where(ticket_id: ticket_id).first
      expect(audit).not_to be_nil
      expect(audit.action).to eq('Criado')
      expect(audit.author).to eq('Arquiteto Seg')
    end

    it 'records status transition in audit logs' do
      status_todo = Status.find_by(name: 'A Fazer')
      status_progress = Status.find_by(name: 'Em Progresso')
      
      ticket = Ticket.create!(
        title: 'Exposição de Chaves de API',
        status_id: status_todo.id,
        priority: 'critical'
      )

      payload = { status_id: status_progress.id, author: 'Analista Vivo' }
      put "/api/tickets/#{ticket.id}", payload.to_json, json_headers
      
      expect(last_response.status).to eq(200)
      expect(ticket.reload.status_id).to eq(status_progress.id)
      
      # Audit log assert
      audit = AuditLog.where(ticket_id: ticket.id, action: 'Atualizado').first
      expect(audit).not_to be_nil
      expect(audit.changes_log).to include("Status alterado de 'A Fazer' para 'Em Progresso'")
      expect(audit.author).to eq('Analista Vivo')
    end
  end

  describe 'Comments API' do
    it 'allows comment creation and generates audit log' do
      status_obj = Status.find_by(name: 'Backlog')
      ticket = Ticket.create!(
        title: 'Review de código Ruby',
        status_id: status_obj.id,
        priority: 'low'
      )

      payload = { author: 'Seguranca Info', content: 'Código revisado sem achados de SAST.' }
      post "/api/tickets/#{ticket.id}/comments", payload.to_json, json_headers
      expect(last_response.status).to eq(201)
      
      expect(ticket.comments.count).to eq(1)
      expect(ticket.comments.first.content).to eq('Código revisado sem achados de SAST.')
      
      # Audit log assertion
      audit = AuditLog.where(ticket_id: ticket.id, action: 'Comentado').first
      expect(audit).not_to be_nil
      expect(audit.author).to eq('Seguranca Info')
    end
  end

  describe 'IAM API' do
    before(:each) do
      # Make sure seeds run for each IAM test
      seed_default_iam
    end

    it 'lists seeded IAM providers' do
      get '/api/iam/providers'
      expect(last_response.status).to eq(200)
      res = JSON.parse(last_response.body)
      expect(res.size).to eq(4)
      expect(res.map { |p| p['provider_type'] }).to include('entraid', 'keycloak', 'oam', 'sailpoint')
    end

    it 'updates provider configuration and handles active toggle' do
      provider = IamProvider.find_by(provider_type: 'keycloak')
      payload = { client_id: 'new-keycloak-id', active: true }
      put "/api/iam/providers/#{provider.id}", payload.to_json, json_headers
      expect(last_response.status).to eq(200)
      
      expect(provider.reload.client_id).to eq('new-keycloak-id')
      expect(provider.active).to be_truthy

      # Other providers should be deactivated
      other = IamProvider.find_by(provider_type: 'entraid')
      expect(other.active).to be_falsy
    end

    it 'synchronizes identities from active provider' do
      # EntraID is active by default
      post '/api/iam/sync'
      expect(last_response.status).to eq(200)
      res = JSON.parse(last_response.body)
      expect(res['users'].size).to eq(2)
      
      user_emails = IamUser.all.map(&:email)
      expect(user_emails).to include('ana.entraid@telefonica.com', 'bernardo.entraid@telefonica.com')
    end

    it 'submits and approves governance request (Sailpoint simulation)' do
      # Submit request
      payload = {
        user_name: 'Julia DevOps',
        user_email: 'julia.devops@telefonica.com',
        requested_role: 'Admin'
      }
      post '/api/iam/requests', payload.to_json, json_headers
      expect(last_response.status).to eq(201)
      
      req = IdentityRequest.last
      expect(req.user_name).to eq('Julia DevOps')
      expect(req.status).to eq('Pendente')

      # Approve request
      approve_payload = { approver: 'Chief SecOps Officer' }
      put "/api/iam/requests/#{req.id}/approve", approve_payload.to_json, json_headers
      expect(last_response.status).to eq(200)
      
      expect(req.reload.status).to eq('Provisionado')
      expect(req.approver).to eq('Chief SecOps Officer')

      # Verification of local provisioning (Sailpoint action target)
      user = IamUser.find_by(email: 'julia.devops@telefonica.com')
      expect(user).not_to be_nil
      expect(user.role).to eq('Admin')
      expect(user.status).to eq('Ativo')
    end

    it 'creates a user manually' do
      payload = {
        name: 'Roberto Local',
        email: 'roberto.local@telefonica.com',
        role: 'Auditor'
      }
      post '/api/iam/users', payload.to_json, json_headers
      expect(last_response.status).to eq(201)
      
      user = IamUser.find_by(email: 'roberto.local@telefonica.com')
      expect(user).not_to be_nil
      expect(user.name).to eq('Roberto Local')
      expect(user.role).to eq('Auditor')
      expect(user.provider_type).to eq('local')
    end

    describe 'Authentication & MFA API' do
      it 'validates credentials and logs in' do
        # Seeded user marcus.goncalves@telefonica.com has password 'CyberITSM@2026!Password'
        user = IamUser.find_by(email: 'marcus.goncalves@telefonica.com')
        user.update!(mfa_enabled: true, mfa_setup_complete: true, mfa_secret: ROTP::Base32.random)

        payload = { email: 'marcus.goncalves@telefonica.com', password: 'CyberITSM@2026!Password' }
        post '/api/auth/login', payload.to_json, json_headers
        expect(last_response.status).to eq(200)
        
        res = JSON.parse(last_response.body)
        expect(res['mfa_required']).to be_truthy

        # Now verify standard MFA code
        totp = ROTP::TOTP.new(user.mfa_secret)
        verify_payload = { email: 'marcus.goncalves@telefonica.com', code: totp.now }
        post '/api/auth/mfa/verify', verify_payload.to_json, json_headers
        expect(last_response.status).to eq(200)

        verify_res = JSON.parse(last_response.body)
        expect(verify_res['token']).to start_with('session-')
        expect(verify_res['user']['name']).to eq('Marcus Gonçalves')
      end

      it 'returns 401 for invalid credentials' do
        payload = { email: 'marcus.goncalves@telefonica.com', password: 'wrong-password' }
        post '/api/auth/login', payload.to_json, json_headers
        expect(last_response.status).to eq(401)
      end

      it 'toggles and verifies MFA' do
        user = IamUser.find_by(email: 'marcus.goncalves@telefonica.com')
        user.update!(mfa_enabled: false, mfa_setup_complete: false)

        # Enable MFA
        toggle_payload = { email: 'marcus.goncalves@telefonica.com', enable: true }
        post '/api/auth/mfa/toggle', toggle_payload.to_json, json_headers
        expect(last_response.status).to eq(200)
        
        res = JSON.parse(last_response.body)
        expect(res['mfa_enabled']).to be_truthy
        expect(res['secret']).not_to be_nil

        # Verify login requires MFA setup now
        login_payload = { email: 'marcus.goncalves@telefonica.com', password: 'CyberITSM@2026!Password' }
        post '/api/auth/login', login_payload.to_json, json_headers
        expect(last_response.status).to eq(200)
        login_res = JSON.parse(last_response.body)
        expect(login_res['mfa_setup_required']).to be_truthy

        # Verify code verify with dynamic TOTP
        totp = ROTP::TOTP.new(res['secret'])
        verify_payload = { email: 'marcus.goncalves@telefonica.com', code: totp.now }
        post '/api/auth/mfa/verify', verify_payload.to_json, json_headers
        expect(last_response.status).to eq(200)
      end

      it 'handles forgot and reset password flow' do
        user = IamUser.find_by(email: 'marcus.goncalves@telefonica.com')
        user.update!(mfa_enabled: false, mfa_setup_complete: true)

        # Forgot password request
        forgot_payload = { email: 'marcus.goncalves@telefonica.com' }
        post '/api/auth/forgot_password', forgot_payload.to_json, json_headers
        expect(last_response.status).to eq(200)
        forgot_res = JSON.parse(last_response.body)
        expect(forgot_res['reset_url']).to include('/login.html?token=')

        # Extract token
        token = forgot_res['reset_url'].split('=').last

        # Reset password
        reset_payload = { token: token, new_password: 'CyberITSM@2026!NewPassword' }
        post '/api/auth/reset_password', reset_payload.to_json, json_headers
        expect(last_response.status).to eq(200)

        # Login with new password
        login_payload = { email: 'marcus.goncalves@telefonica.com', password: 'CyberITSM@2026!NewPassword' }
        post '/api/auth/login', login_payload.to_json, json_headers
        expect(last_response.status).to eq(200)
      end
    end

    describe 'RBAC (Role-Based Access Control) Integration' do
      let(:rbac_headers) { { 'CONTENT_TYPE' => 'application/json', 'HTTP_X_TEST_RBAC' => 'true' } }

      it 'blocks Analyst/Requester/Auditor from creating users (returns 403)' do
        requester = IamUser.create!(
          name: 'Requester Test',
          email: 'req.test@telefonica.com',
          role: 'Requester',
          provider_type: 'local',
          status: 'Ativo',
          password: 'CyberITSM@2026!Password',
          mfa_enabled: false
        )
        # Log in
        post '/api/auth/login', { email: 'req.test@telefonica.com', password: 'CyberITSM@2026!Password' }.to_json, json_headers
        login_res = JSON.parse(last_response.body)
        
        # Verify MFA
        totp = ROTP::TOTP.new(login_res['secret'])
        post '/api/auth/mfa/verify', { email: 'req.test@telefonica.com', code: totp.now }.to_json, json_headers
        expect(last_response.status).to eq(200)

        # Now, try to create a user manually.
        post '/api/iam/users', { name: 'Hack User', email: 'hack@test.com' }.to_json, rbac_headers
        expect(last_response.status).to eq(403)
        expect(JSON.parse(last_response.body)['error']).to include('Acesso negado')
      end

      it 'allows Admin to create users' do
        admin = IamUser.create!(
          name: 'Admin Test',
          email: 'admin.test@telefonica.com',
          role: 'Admin',
          provider_type: 'local',
          status: 'Ativo',
          password: 'CyberITSM@2026!Password',
          mfa_enabled: false
        )
        post '/api/auth/login', { email: 'admin.test@telefonica.com', password: 'CyberITSM@2026!Password' }.to_json, json_headers
        login_res = JSON.parse(last_response.body)
        
        # Verify MFA
        totp = ROTP::TOTP.new(login_res['secret'])
        post '/api/auth/mfa/verify', { email: 'admin.test@telefonica.com', code: totp.now }.to_json, json_headers
        expect(last_response.status).to eq(200)

        # Now, create a user manually.
        post '/api/iam/users', { name: 'Success User', email: 'success@test.com' }.to_json, rbac_headers
        expect(last_response.status).to eq(201)

        # Verify that a SystemAuditLog was written
        log = SystemAuditLog.last
        expect(log).not_to be_nil
        expect(log.action).to eq('Usuário Criado')
        expect(log.description).to include('Success User')
      end

      it 'allows Admin to view system audit logs' do
        # Log in as Admin
        admin = IamUser.create!(
          name: 'Admin Test 2',
          email: 'admin.test2@telefonica.com',
          role: 'Admin',
          provider_type: 'local',
          status: 'Ativo',
          password: 'CyberITSM@2026!Password',
          mfa_enabled: false
        )
        post '/api/auth/login', { email: admin.email, password: 'CyberITSM@2026!Password' }.to_json, json_headers
        login_res = JSON.parse(last_response.body)
        
        totp = ROTP::TOTP.new(login_res['secret'])
        post '/api/auth/mfa/verify', { email: admin.email, code: totp.now }.to_json, json_headers
        expect(last_response.status).to eq(200)

        # Fetch audit logs
        get '/api/admin/audit_logs', {}, rbac_headers
        expect(last_response.status).to eq(200)
        logs = JSON.parse(last_response.body)
        expect(logs).to be_an(Array)
      end

      it 'blocks Requester from viewing system audit logs' do
        # Log in as Requester
        req = IamUser.create!(
          name: 'Requester Test 2',
          email: 'req.test2@telefonica.com',
          role: 'Requester',
          provider_type: 'local',
          status: 'Ativo',
          password: 'CyberITSM@2026!Password',
          mfa_enabled: false
        )
        post '/api/auth/login', { email: req.email, password: 'CyberITSM@2026!Password' }.to_json, json_headers
        login_res = JSON.parse(last_response.body)
        
        totp = ROTP::TOTP.new(login_res['secret'])
        post '/api/auth/mfa/verify', { email: req.email, code: totp.now }.to_json, json_headers
        expect(last_response.status).to eq(200)

        # Try to fetch audit logs
        get '/api/admin/audit_logs', {}, rbac_headers
        expect(last_response.status).to eq(403)
      end
    end
  end
end
