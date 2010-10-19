require "migration_helpers"

class AddRemainingdaysreadToCards < ActiveRecord::Migration
  extend MigrationHelpers

  def self.up
    add_column(:cards, :rd_needread, :integer, :null => false, :default => 0)
  end

  def self.down
    remove_column :cards, :rd_needread
  end
end

