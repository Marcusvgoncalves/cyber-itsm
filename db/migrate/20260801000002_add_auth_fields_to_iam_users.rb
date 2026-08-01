class AddAuthFieldsToIamUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :iam_users, :password_digest, :string
    add_column :iam_users, :mfa_secret, :string
    add_column :iam_users, :mfa_enabled, :boolean, default: false
    add_column :iam_users, :reset_token, :string
    add_column :iam_users, :reset_token_expires_at, :datetime
  end
end
