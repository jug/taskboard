require "migration_helpers"

class AddColtypeToColumns < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    # "type" is a reserved column -> so use "coltype"
    add_column(:columns, :coltype, :integer, :null => false, :default => 0)
  end

  def self.down
    remove_column :columns, :coltype
  end
end

