# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_04_131500) do
  create_table "audit_logs", force: :cascade do |t|
    t.string "action", null: false
    t.string "author"
    t.text "changes_log"
    t.datetime "created_at", null: false
    t.integer "ticket_id", null: false
    t.datetime "updated_at", null: false
    t.index ["ticket_id"], name: "index_audit_logs_on_ticket_id"
  end

  create_table "comments", force: :cascade do |t|
    t.string "author", null: false
    t.text "content", null: false
    t.datetime "created_at", null: false
    t.integer "ticket_id", null: false
    t.datetime "updated_at", null: false
    t.index ["ticket_id"], name: "index_comments_on_ticket_id"
  end

  create_table "iam_providers", force: :cascade do |t|
    t.boolean "active", default: false
    t.string "client_id"
    t.string "client_secret"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.string "provider_type", null: false
    t.text "settings"
    t.datetime "updated_at", null: false
  end

  create_table "iam_users", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "email", null: false
    t.boolean "mfa_enabled", default: false
    t.string "mfa_secret"
    t.boolean "mfa_setup_complete", default: false
    t.string "name", null: false
    t.string "password_digest"
    t.string "provider_type", null: false
    t.string "reset_token"
    t.datetime "reset_token_expires_at"
    t.string "role", default: "Requester"
    t.string "status", default: "Ativo"
    t.datetime "updated_at", null: false
  end

  create_table "identity_requests", force: :cascade do |t|
    t.string "action_type", default: "RoleChange"
    t.string "approver"
    t.datetime "created_at", null: false
    t.text "log"
    t.string "requested_role", null: false
    t.string "status", default: "Pendente"
    t.datetime "updated_at", null: false
    t.string "user_email", null: false
    t.string "user_name", null: false
  end

  create_table "statuses", force: :cascade do |t|
    t.string "category", default: "todo"
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.integer "position", default: 0
    t.datetime "updated_at", null: false
  end

  create_table "system_audit_logs", force: :cascade do |t|
    t.string "action", null: false
    t.string "author", null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.datetime "updated_at", null: false
  end

  create_table "tickets", force: :cascade do |t|
    t.string "assignee_email"
    t.string "assignee_name"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "framework_cis"
    t.string "framework_iso"
    t.string "framework_nist"
    t.string "framework_sabsa"
    t.string "key", null: false
    t.string "priority", default: "medium"
    t.integer "status_id", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["status_id"], name: "index_tickets_on_status_id"
  end

  add_foreign_key "audit_logs", "tickets"
  add_foreign_key "comments", "tickets"
  add_foreign_key "tickets", "statuses"
end
