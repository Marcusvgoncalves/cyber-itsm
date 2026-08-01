require './app'
require 'sinatra/activerecord/rake'

# Default task runs tests
task default: :spec

desc 'Run automated RSpec tests'
task :spec do
  sh 'bundle exec rspec'
end
