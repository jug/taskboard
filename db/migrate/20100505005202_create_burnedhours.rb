require "migration_helpers"

class CreateBurnedhours < ActiveRecord::Migration
   extend MigrationHelpers

  def self.up
    create_table :burnedhours do |t|
      t.integer  :taskboard_id, :null => false
      t.date     :date, :null => false
      t.integer  :hours, :null => false
    end

    add_index :burnedhours, [:taskboard_id, :date]
    add_foreign_key(:burnedhours, :taskboard_id, :taskboards)
  end

  def self.down
    drop_table :burnedhours
  end
end

