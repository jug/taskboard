# Copyright (C) 2009 Cognifide
#
# This file is part of Taskboard.
#
# Taskboard is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Taskboard is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Taskboard. If not, see <http://www.gnu.org/licenses/>.

class Taskboard < ActiveRecord::Base

  validates_presence_of :name

  belongs_to :project

  has_many :cards
  has_many :columns, :order => "position"
  has_many :rows, :order => "position"
  has_many :burnedhours, :order => "date"

  has_one :initburndown, :dependent => :destroy

  DEFAULT_NAME = "Brand new taskboard"

  def clone with_hours = 0
    clonned_taskboard = Taskboard.new(:name => name, :project => project)

    columns_map = {}
    rows_map = {}

    columns.sort{|col1, col2| col1.position <=> col2.position}.each { |column|
      clonned_column = column.clone
      clonned_taskboard.columns << clonned_column
      columns_map[column.id] = clonned_column
    }

    rows.sort{|row1, row2| row1.position <=> row2.position}.each { |row|
      clonned_row = row.clone
      clonned_taskboard.rows << clonned_row
      rows_map[row.id] = clonned_row
    }

    clonned_taskboard.save!

    cards.sort{|c1, c2| c1.position <=> c2.position}.each { |card|
      clonned_card = card.clone clonned_taskboard.id, columns_map[card.column_id].id, rows_map[card.row_id].id
      clonned_card.save!

      # copy hours if requested
      h_left = card.hours_left
      if with_hours and h_left > 0
        clonned_card.update_hours h_left
      end
    }

    # copy initburndown if existing
    if not initburndown.nil?
      cloned_initburndown = initburndown.clone_essential_only clonned_taskboard.id
      cloned_initburndown.save!
    end

    # don't copy burnedhours

    clonned_taskboard
  end

  def burndown
    burndown = Hash.new(0)
    self.cards.each { |card|
      card.burndown.each_pair { |date, hours|
        burndown[date] += hours
      }
    }

    return burndown
  end

  def update_burnedhours hours, added_at = Time.now, use_duetime = true
    chktime_at = added_at
    if use_duetime and not initburndown.nil? and initburndown.duetime > 0
      chktime_at = Time.at( chktime_at.to_i + 24*60*60 - initburndown.duetime )
    end

    burnedhour = self.burnedhours.sort{|x,y| y.date <=> x.date }.select {|h|
      h.date.beginning_of_day <= chktime_at && h.date.end_of_day >= chktime_at
    }[0]
    if burnedhour.nil?
      self.burnedhours << Burnedhour.new(:taskboard_id => id, :date => chktime_at, :hours => hours )
      self.updated_at = Time.now
      self.save
    else
      Burnedhour.update_counters burnedhour.id, :hours => hours
    end
  end

  def to_json options = {}
    options[:include] = { :columns => {}, :rows => {}, :burnedhours => {},
                          :cards => { :methods => [:tag_list, :hours_left, :hours_left_updated] } }
    options[:except] = [:created_at, :updated_at]
    super(options)
  end
end
