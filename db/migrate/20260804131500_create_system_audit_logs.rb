class CreateSystemAuditLogs < ActiveRecord::Migration[7.1]
  def change
    create_table :system_audit_logs do |t|
      t.string :action, null: false
      t.string :author, null: false
      t.text :description
      t.timestamps
    end
  end
end
