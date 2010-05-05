require "migration_helpers"

class AddTypeToColumns < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    add_column(:columns, :type, :integer, :null => false, :default => 0)
  end

  def self.down
    remove_column :columns, :type
  end
end

