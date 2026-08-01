class AddMfaSetupCompleteToIamUsers < ActiveRecord::Migration[7.0]
  def change
    add_column :iam_users, :mfa_setup_complete, :boolean, default: false
  end
end
