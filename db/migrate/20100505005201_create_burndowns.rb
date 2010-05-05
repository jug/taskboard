require "migration_helpers"

class CreateBurndowns < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    create_table :burndowns do |t|
      t.integer  :taskboard_id, :null => false
      t.string   :dates, :null => false
      t.integer  :capacity, :null => false, :default => 0
      t.integer  :slack, :null => false, :default => 0
      t.integer  :commitment_po, :null => false, :default => 0
      t.integer  :commitment_team, :null => false, :default => 0
    end

    add_index :burndowns, :taskboard_id
    add_foreign_key(:burndowns, :taskboard_id, :taskboards)
  end

  def self.down
    drop_table :burndowns
  end
end

