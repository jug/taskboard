require "migration_helpers"

class AddFoldToRows < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    add_column(:rows, :fold, :integer, :null => false, :default => 0)
  end

  def self.down
    remove_column :rows, :fold
  end
end

