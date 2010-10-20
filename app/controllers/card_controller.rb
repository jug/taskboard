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

class CardController < JuggernautSyncController

  include ApplicationHelper

  before_filter :authorize_read_only, :except => ["load_burndown"]

  def update_name
    @card = Card.find(params[:id].to_i)
    before = @card.name
    @card.name = params[:name]
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.name, :message => "Card '#{before}' renamed to '#{@card.name}'"})
  end

  def update_notes
    @card = Card.find(params[:id].to_i)
    before = @card.notes.nil? ? '' : @card.notes.gsub(/\n/, "\\n")
    @card.notes = params[:notes]
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.notes.gsub(/\n/, "\\n"), :message => "Notes updated for '#{@card.name}'"})
  end

  def change_color
    card = Card.find(params[:id].to_i)
    if card.change_color(params[:color])
      render :json => sync_change_card_color(card)
    else
      send_error 'Invalid card new color!'
    end
  end

  def update_hours
    if params[:updated_at] == 'yesterday'
      updated_at = 1.day.ago
    elsif params[:updated_at] == 'tomorrow'
      updated_at = 1.day.from_now
    else
      updated_at = Time.now
    end

    new_hours_left = params[:hours_left].to_i
    if new_hours_left <= 0 and not params[:hours_left].strip == "0"
      send_error 'Hours left should be a positive number!'
    else
      @card = Card.find(params[:id].to_i)
      before = @card.hours_left
      @card.update_hours(new_hours_left, updated_at)

      if before != new_hours_left
        column = Column.find(@card.column_id)
        if column.coltype == 1
          taskboard = Taskboard.find(@card.taskboard_id)
          taskboard.update_burnedhours new_hours_left - before
        end
      end

      render :json => sync_update_card(@card, { :before => before, :after => @card.hours_left, :message => "Hours updated for '#{@card.name}'"})
    end
  end

  def add_tag
    @card = Card.find(params[:id].to_i)
    tags = params[:tags].split(',')
    tags.each { |tag| tag.strip! }
    before = @card.tag_list.to_s
    @card.tag_list.add(tags)
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.tag_list.to_s, :message => "Tags added to '#{@card.name}'"})
  end

  def remove_tag
    @card = Card.find(params[:id].to_i)
    before = @card.tag_list.to_s
    @card.tag_list.remove(params[:tag])
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.tag_list.to_s, :message => "Tags removed from '#{@card.name}'"})
  end

  def load_burndown
    @card = Card.find(params[:id].to_i)
    render :text => burndown(@card)
  end

  def clear_rd
    @card = Card.find(params[:id].to_i)
    before = @card.rd_days
    @card.rd_id = 0
    @card.rd_days = 0
    @card.rd_updated = nil
    @card.rd_needread = 0
    @card.rd_note = ""
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.rd_id, :message => "Cleared Remaining Days for '#{@card.name}'"})
  end

  def update_rd_id
    @card = Card.find(params[:id].to_i)
    before = @card.rd_id
    @card.rd_id = params[:new_id].to_i
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.rd_id, :message => "Remaining Days Id updated for '#{@card.name}'"})
  end

  def update_rd_days
    @card = Card.find(params[:id].to_i)
    before = @card.rd_days
    @card.rd_days = params[:days_left].to_i
    @card.rd_needread = params[:need_read].to_i
    @card.rd_updated = Time.now
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.rd_id, :message => "Remaining Days Left updated for '#{@card.name}'"})
  end

  def update_rd_note
    @card = Card.find(params[:id].to_i)
    before = @card.rd_note
    @card.rd_note = params[:note]
    # note: rd_updated is not updated for rd_note
    @card.updated_at = Time.now
    @card.save
    render :json => sync_update_card(@card, { :before => before, :after => @card.rd_id, :message => "Remaining Days Note updated for '#{@card.name}'"})
  end

  def mark_read_rd_all
    tb_id = params[:id].to_i

    # NOTE: "where" is not working in this ruby-activerecord-version
    # ccpm_cards = Card.where( "taskboard_id = ? AND rd_id > 0 AND rd_days > 0", params[:id].to_i )
    ccpm_cards = Card.find_by_sql( "SELECT * FROM cards WHERE taskboard_id = #{tb_id} AND rd_id > 0 AND rd_days > 0 AND rd_needread" )
    card_ids = []
    ccpm_cards.each { |card|
      card.rd_needread = 0
      card.rd_updated = Time.now
      card.updated_at = Time.now
      card.save
    }

    # NOTE: taskboard_id required in case of empty cards-array
    render :json => sync_update_cards(ccpm_cards, { :taskboard_id => tb_id, :message => "Mark #{ccpm_cards.length} cards as Read" })
  end

  private

  def send_error message = 'Error!'
    render :json => "{ status: 'error', message: '#{message}' }"
  end

end
