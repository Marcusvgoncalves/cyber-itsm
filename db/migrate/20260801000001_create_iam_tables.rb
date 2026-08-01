class CreateIamTables < ActiveRecord::Migration[7.0]
  def change
    create_table :iam_providers do |t|
      t.string :name, null: false
      t.string :provider_type, null: false # 'entraid', 'keycloak', 'oam', 'sailpoint'
      t.string :client_id
      t.string :client_secret
      t.text :settings # JSON string for additional settings
      t.boolean :active, default: false
      t.timestamps
    end

    create_table :iam_users do |t|
      t.string :name, null: false
      t.string :email, null: false
      t.string :role, default: 'Requester' # 'Admin', 'Analyst', 'Requester', 'Auditor'
      t.string :provider_type, null: false
      t.string :status, default: 'Ativo' # 'Ativo', 'Bloqueado'
      t.timestamps
    end

    create_table :identity_requests do |t|
      t.string :user_name, null: false
      t.string :user_email, null: false
      t.string :requested_role, null: false
      t.string :action_type, default: 'RoleChange' # 'Provision', 'Deprovision', 'RoleChange'
      t.string :status, default: 'Pendente' # 'Pendente', 'Aprovado', 'Provisionado'
      t.string :approver
      t.text :log
      t.timestamps
    end
  end
end
