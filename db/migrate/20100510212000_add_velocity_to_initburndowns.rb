require "migration_helpers"

class AddVelocityToInitburndowns < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    add_column(:initburndowns, :velocity, :integer, :null => false, :default => 5000) # 50%
  end

  def self.down
    remove_column :initburndowns, :velocity
  end
end

