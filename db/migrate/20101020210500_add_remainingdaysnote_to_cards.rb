require "migration_helpers"

class AddRemainingdaysnoteToCards < ActiveRecord::Migration
  extend MigrationHelpers

  def self.up
    add_column(:cards, :rd_note, :string, :null => false, :limit => 128, :default => '')
  end

  def self.down
    remove_column :cards, :rd_note
  end
end

