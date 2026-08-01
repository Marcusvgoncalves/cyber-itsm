class CreateTables < ActiveRecord::Migration[7.0]
  def change
    create_table :statuses do |t|
      t.string :name, null: false
      t.integer :position, default: 0
      t.string :category, default: 'todo' # 'todo', 'in_progress', 'done'
      t.timestamps
    end

    create_table :tickets do |t|
      t.string :key, null: false
      t.string :title, null: false
      t.text :description
      t.references :status, null: false, foreign_key: true
      t.string :priority, default: 'medium' # 'low', 'medium', 'high', 'critical'
      t.string :framework_nist
      t.string :framework_cis
      t.string :framework_iso
      t.string :framework_sabsa
      t.string :assignee_name
      t.string :assignee_email
      t.timestamps
    end

    create_table :comments do |t|
      t.references :ticket, null: false, foreign_key: true
      t.string :author, null: false
      t.text :content, null: false
      t.timestamps
    end

    create_table :audit_logs do |t|
      t.references :ticket, null: false, foreign_key: true
      t.string :action, null: false
      t.text :changes_log
      t.string :author
      t.timestamps
    end
  end
end
