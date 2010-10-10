require "migration_helpers"

class AddRemainingdaysToCards < ActiveRecord::Migration
  extend MigrationHelpers

  def self.up
    add_column(:cards, :rd_id,      :integer, :null => false, :default => 0)
    add_column(:cards, :rd_days,    :integer, :null => false, :default => 0)
    add_column :cards, :rd_updated, :datetime
  end

  def self.down
    remove_column :cards, :rd_id
    remove_column :cards, :rd_days
    remove_column :cards, :rd_updated
  end
end

