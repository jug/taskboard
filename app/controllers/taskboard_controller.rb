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

class TaskboardController < JuggernautSyncController
  include ApplicationHelper

  before_filter :authorize_read_only, :except => ["show", "index", "get_taskboard", "load_burndown", "get_initburndown"]

  def index
    redirect_to :controller => 'project', :action => 'index'
  end

  def show
    @taskboard_id = params[:id].to_i
  end

  def add_taskboard
    if params[:project_id].blank?
      flash[:error] = "You need to specify project id!"
      redirect_to :action => 'index'
    else
      taskboard = Taskboard.new
      taskboard.name = params[:name].blank? ? Taskboard::DEFAULT_NAME : params[:name]
      taskboard.project_id = params[:project_id]
      taskboard.columns << Column.new(:name => Column::DEFAULT_NAME)
      taskboard.rows << Row.new(:name => Row::DEFAULT_NAME)
      taskboard.save!
      redirect_to :controller => 'project', :action => 'index'
    end
  end

  def clone_taskboard
    if params[:id].empty?
      flash[:error] = "Source taskboard should be set!"
      redirect_to :action => 'index'
    else
      taskboard = Taskboard.find(params[:id].to_i)
      clonned = taskboard.clone
      clonned.name = 'Copy of ' + taskboard.name
      clonned.save!
      redirect_to :controller => 'project', :action => 'index'
    end
  end

  def get_taskboard
    render :json => Taskboard.find(params[:id].to_i).to_json
  end

  def rename_taskboard
    taskboard = Taskboard.find(params[:id].to_i)
    if not params[:name].blank?
      before = taskboard.name
      taskboard.name = params[:name]
      taskboard.save!
      render :json => sync_rename_taskboard(taskboard, { :before => before })
    else
      send_error 'Taskboard name cannot be empty!'
    end
  end

  def add_column
    column = insert_column params[:taskboard_id].to_i, params[:name]
    render :json => sync_add_column(column)
  end

  def reorder_columns
    column = Column.find(params[:id].to_i)
    before = column.position
    column.insert_at(params[:position].to_i)
    render :json => sync_move_column(column, { :before => before })
  end

  def rename_column
    column = Column.find(params[:id].to_i)
    if not params[:name].empty?
      before = column.name
      column.name = params[:name]
      column.save!
      render :json => sync_rename_column(column, { :before => before })
    else
      send_error 'Column name cannot be empty!'
    end
  end

  def remove_column
    # first remove from list, than delete from db
    # to keep the rest of the list consistent
    column = Column.find(params[:id].to_i)
    column.remove_from_list
    Column.delete params[:id].to_i
    render :json => sync_delete_column(column)
  end

  def clean_column
    column = Column.find(params[:id].to_i)
    column.cards.each { |card|
      card.remove_from_list
      Card.delete card.id
    }
    render :json => sync_clean_column(column)
  end

  def add_row
    row = insert_row params[:taskboard_id].to_i
    render :json => sync_add_row(row)
  end

  def remove_row
    # first remove from list, than delete from db
    # to keep the rest of the list consistent
    row = Row.find(params[:id].to_i)
    row.remove_from_list
    Row.delete params[:id].to_i
    render :json => sync_delete_row(row)
  end

  def clean_row
    row = Row.find(params[:id].to_i)
    row.cards.each { |card|
      card.remove_from_list
      Card.delete card.id
    }
    render :json => sync_clean_row(row)
  end

  def reorder_rows
    row = Row.find(params[:id].to_i)
    new_pos = params[:position].to_i;
    before = row.position

    max_row = Row.first( :select => "MAX(position) AS position",
                         :conditions => { :taskboard_id => row.taskboard_id } )
    max_pos = max_row.position
    if new_pos < 1
      new_pos = 1
    elsif new_pos > max_pos
      new_pos = max_pos
    end

    if row.position != new_pos
      row.insert_at(new_pos)
    end
    render :json => sync_move_row(row, { :before => before })
  end

  def copy_row
    src_row = Row.find(params[:src_id].to_i)
    trg_row = Row.find(params[:trg_id].to_i)

    # mapping for column-positions
    cmap = [] # src-col-pos => trg-col-id
    max_colpos = 0
    trg_cols = Column.all( :conditions => { :taskboard_id => trg_row.taskboard_id },
                           :order => "position" )
    trg_cols.each { |col|
      cmap[col.position] = col.id
      if col.position > max_colpos
        max_colpos = col.position
      end
    }
    src_cols = Column.all( :conditions => { :taskboard_id => src_row.taskboard_id },
                           :order => "position" )
    src_cols.each { |col|
      if col.position > max_colpos
        cmap[col.position] = cmap[max_colpos]
      end
    }

    # copy cards from src-row to target-row
    updated_cards = []
    src_row.cards.each { |card|
      old_hours_left = card.hours_left
      new_card = card.clone( trg_row.taskboard_id, cmap[card.column.position], trg_row.id )
      new_card.save!
      new_card.move_to_bottom
      if old_hours_left > 0
         new_card.update_hours old_hours_left
      end
      updated_cards << new_card
    }

    if updated_cards.empty?
      send_success
    else
      render :json => sync_copy_row(trg_row, updated_cards)
    end
  end

  def add_card
    name = params[:name]
    taskboard_id = params[:taskboard_id].to_i
    column_id = params[:column_id]
    row_id = params[:row_id]

    if column_id.nil? or column_id == ''
      new_column = insert_column taskboard_id
      column_id = new_column.id
      sync_add_column(new_column)
    else
      column_id = params[:column_id].to_i
    end

    if row_id.nil? or row_id == ''
      row_id = Taskboard.find(taskboard_id).rows.first.id
    else
      row_id = row_id.to_i
    end

    cards = []

    begin
      if JiraParser.is_jira_url(name)
        cards = JiraParser.fetch_cards(name)
      elsif UrlParser.is_url(name)
        cards = UrlParser.fetch_cards(name)
      else
        cards << Card.new(:taskboard_id => taskboard_id, :column_id => column_id, :row_id => row_id, :name => name)
      end
    rescue
      render :text => "{ status: 'error', message: '#{$!.message}' }"
    else
      taskboard = Taskboard.find(taskboard_id)
      issues = taskboard.cards.collect {|card| card.issue_no unless card.issue_no.nil?}

      updated_cards = cards.select{ |card|
        card.issue_no.nil? or not issues.include?(card.issue_no)
      }.each{ |card|
        card.taskboard_id = taskboard_id
        card.column_id = column_id
        card.row_id = row_id
        card.save!
        card.insert_at(1)
      }

      if updated_cards.empty?
        send_success
      else
        render :json => sync_add_cards(updated_cards)
      end
    end
  end

  def copy_card
    src_card = Card.find(params[:id].to_i)
    is_copy = params[:copy].to_i

    if is_copy == 1
      old_hours_left = src_card.hours_left
      card = src_card.clone
      card.save!
      card.insert_at( src_card.position + 1 )
      if old_hours_left > 0
         card.update_hours old_hours_left
      end
    else
      card = Card.new(:taskboard_id => src_card.taskboard_id,
                      :column_id => src_card.column_id, :row_id => src_card.row_id,
                      :name => "TODO",
                      :color => src_card.color)
      card.save!
      card.move_to_bottom
    end

    render :json => sync_copy_card(card, is_copy)
  end

  def reorder_cards
    card = Card.find(params[:id].to_i)
    before = "#{card.position} @ #{card.column.name}"
    target_column_id = params[:column_id].to_i unless params[:column_id].blank?
    target_row_id = params[:row_id].to_i unless params[:row_id].blank?
    target_position = params[:position].to_i unless params[:position].blank?

    card.move_to(target_column_id, target_row_id, target_position)
    render :json => sync_move_card(card, { :before => before })
  end

  def remove_card
    # first remove from list, than delete from db
    # to keep the rest of the list consistent
    card = Card.find(params[:id].to_i)
    card.remove_from_list
    Card.delete params[:id].to_i
    render :json => sync_delete_card(card)
  end

  def load_burndown
    taskboard = Taskboard.find(params[:id].to_i)
    render :text => burndown(taskboard)
  end

  def get_initburndown
    taskboard_id = params[:id].to_i
    initburndown = create_initburndown(taskboard_id)
    render :json => initburndown.to_json
  end

  def update_initburndown
    taskboard_id = params[:taskboard_id].to_i

    after = ''
    cols_arr = params[:cols_arr].split(' ')
    cols_updarr = []
    i = 0
    while i < cols_arr.length do
      col_id = cols_arr[i].to_i
      col_type = cols_arr[i + 1].to_i
      i = i + 2
      column = Column.find(col_id)
      if column.coltype != col_type
        after = after + col_id.to_s + ":" + column.coltype.to_s + ">" + col_type.to_s + " "
        cols_updarr.push( col_id.to_s, col_type.to_s )
      end
      column.coltype = col_type
      column.save!
    end

    initburndown = create_initburndown(taskboard_id)
    initburndown.capacity = params[:capacity].to_i
    initburndown.slack = params[:slack].to_i
    initburndown.commitment_po = params[:commitment_po].to_i
    initburndown.commitment_team = params[:commitment_team].to_i
    initburndown.save!

    render :json => sync_update_initburndown( taskboard_id, cols_updarr.join(' '), { :after => after } )
  end

  private

    def insert_column taskboard_id, name = Column::DEFAULT_NAME, position = 1
      column = Column.new(:name => name, :taskboard_id => taskboard_id)
      column.save!
      column.insert_at(position)
      return column
    end

    def insert_row taskboard_id, name = Row::DEFAULT_NAME, position = nil
      position ||= Taskboard.find(taskboard_id).rows.size + 1
      row = Row.new(:name => name, :taskboard_id => taskboard_id)
      row.save!
      row.insert_at(position)
      return row
    end

    def create_initburndown taskboard_id
      if Initburndown.exists?(:taskboard_id => taskboard_id)
        initburndown = Initburndown.find_by_taskboard_id(taskboard_id)
      else
        initburndown = Initburndown.new(:taskboard_id => taskboard_id, :dates => "")
      end
      initburndown
    end

    def send_success message = ''
      if message.empty?
        render :text => "{ status : 'success' }"
      else
        render :text => "{ status : 'success', message: #{message.to_json} }"
      end
    end

    def send_error message = 'Error!'
      render :text => "{ status: 'error', message: #{message.to_json} }"
    end
end
