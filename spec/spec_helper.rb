ENV['RACK_ENV'] = 'test'

require File.expand_path('../../app', __FILE__)
require 'rspec'
require 'rack/test'

module RSpecMixin
  include Rack::Test::Methods
  def app
    Sinatra::Application
  end
end

RSpec.configure do |config|
  config.include RSpecMixin

  config.before(:suite) do
    # Clean databases & migrate
    ActiveRecord::Base.establish_connection(YAML.load(ERB.new(File.read('config/database.yml')).result)['test'])
  end

  config.before(:each) do
    # Clean up records
    Comment.destroy_all
    AuditLog.destroy_all
    Ticket.destroy_all
    Status.destroy_all
    IamProvider.destroy_all
    IamUser.destroy_all
    IdentityRequest.destroy_all
    
    # Reseed statuses
    seed_default_statuses
  end
end
