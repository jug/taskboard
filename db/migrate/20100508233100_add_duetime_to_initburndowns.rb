require "migration_helpers"

class AddDuetimeToInitburndowns < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    add_column(:initburndowns, :duetime, :integer, :null => false, :default => 13*60*60) # 13:00
  end

  def self.down
    remove_column :initburndowns, :duetime
  end
end

