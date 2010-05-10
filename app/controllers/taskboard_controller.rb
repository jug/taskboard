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

  before_filter :authorize_read_only, :except => ["show", "index", "get_taskboard", "load_burndown", "get_initburndown", "get_fixburndown", "load_burndown2"]

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
    sumhours = 0
    column = Column.find(params[:id].to_i)
    column.cards.each { |card|
      sumhours = sumhours + card.hours_left
      card.remove_from_list
      Card.delete card.id
    }

    if sumhours > 0 and column.coltype == 1
      taskboard = Taskboard.find(column.taskboard_id)
      taskboard.update_burnedhours -sumhours
    end

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
    sumhours = 0
    row = Row.find(params[:id].to_i)
    row.cards.each { |card|
      hours_left = card.hours_left
      if hours_left > 0
        column = Column.find(card.column_id)
        if column.coltype == 1
          sumhours = sumhours + hours_left
        end
      end
      card.remove_from_list
      Card.delete card.id
    }

    if sumhours > 0
      taskboard = Taskboard.find(row.taskboard_id)
      taskboard.update_burnedhours -sumhours
    end

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
    cburndownmap = [] # col_id => 0|1 (=is-burndown-col)
    max_colpos = 0
    trg_cols = Column.all( :conditions => { :taskboard_id => trg_row.taskboard_id },
                           :order => "position" )
    trg_cols.each { |col|
      cmap[col.position] = col.id
      cburndownmap[col.id] = col.coltype
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
    sumhours = 0
    updated_cards = []
    src_row.cards.each { |card|
      old_hours_left = card.hours_left
      col_id = cmap[card.column.position]
      new_card = card.clone( trg_row.taskboard_id, col_id, trg_row.id )
      new_card.save!
      new_card.move_to_bottom
      if old_hours_left > 0
        new_card.update_hours old_hours_left

        if cburndownmap[col_id] == 1
          sumhours = sumhours + old_hours_left
        end
      end
      updated_cards << new_card
    }

    if sumhours > 0
      taskboard = Taskboard.find(trg_row.taskboard_id)
      taskboard.update_burnedhours sumhours
    end

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

        column = Column.find(card.column_id)
        if column.coltype == 1
          taskboard = Taskboard.find(card.taskboard_id)
          taskboard.update_burnedhours old_hours_left
        end
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

    if card.column_id != target_column_id
      hours_left = card.hours_left
      if hours_left > 0
        src_column = Column.find(card.column_id)
        trg_column = Column.find(target_column_id)
        if src_column.coltype != trg_column.coltype
          taskboard = Taskboard.find(card.taskboard_id)
          if src_column.coltype == 1
            factor = -1
          else
            factor = 1
          end
          taskboard.update_burnedhours factor * hours_left
        end
      end
    end

    card.move_to(target_column_id, target_row_id, target_position)
    render :json => sync_move_card(card, { :before => before })
  end

  def remove_card
    # first remove from list, than delete from db
    # to keep the rest of the list consistent
    card = Card.find(params[:id].to_i)
    hours_left = card.hours_left
    if hours_left > 0
      column = Column.find(card.column_id)
      if column.coltype == 1
        taskboard = Taskboard.find(card.taskboard_id)
        taskboard.update_burnedhours -hours_left
      end
    end
    card.remove_from_list
    Card.delete params[:id].to_i
    render :json => sync_delete_card(card)
  end

  def load_burndown
    taskboard = Taskboard.find(params[:id].to_i)
    render :text => burndown(taskboard)
  end

  # result: { initburndown => .., count => n, data => [ [ x_label, hours ], ...] }
  def load_burndown2
    taskboard = Taskboard.find(params[:id].to_i)
    result = {}

    if not taskboard.initburndown.nil?
      hours_map = get_initburndown_hours( taskboard, taskboard.initburndown.dates )
      hours_arr = hours_map['hours']

      data_arr = []
      hours_arr.each { |item_arr|
        time_label = "%d.%d." % [ item_arr[0][8..9].to_i, item_arr[0][5..6].to_i ]
        data_arr.push [ time_label, item_arr[1] ]
      }

      result['initburndown'] = taskboard.initburndown
      result['count'] = hours_map['count']
      result['data'] = data_arr
    else
      result['initburndown'] = create_initburndown(taskboard.id)
      result['count'] = 0
      result['data'] = []
    end

    render :json => result.to_json
  end

  def get_initburndown
    taskboard_id = params[:id].to_i
    initburndown = create_initburndown(taskboard_id)
    render :json => initburndown.to_json
  end

  def update_initburndown
    taskboard_id = params[:taskboard_id].to_i
    after = ''

    # parse .dates + date-sort
    dates_trg = []
    dates_trg_sort = {} # secs => DD.MM.YYYY
    dates_arr = params[:dates].strip.split(/\s+/)
    dates_arr.each { |date_str|
      match_data = /^(\d\d?)\.(\d\d?)\.(\d{4})?$/.match( date_str )
      date_year = match_data[3].to_i
      if date_year == 0
        date_year = Time.now.year.to_i
      end
      date_chk = "%02d.%02d.%04d" % [ match_data[1].to_i, match_data[2].to_i, date_year ]
      if dates_trg.index( date_chk ).nil?
        dates_trg.push( date_chk )
        date_i = Time.mktime( date_year, match_data[2].to_i, match_data[1].to_i, 0, 0, 0, 0).to_i
        dates_trg_sort[date_i] = date_chk
      end
    }
    dates_trg_sorted = []
    dates_trg_sort.keys.sort.each { |date_i|
      dates_trg_sorted.push dates_trg_sort[date_i]
    }

    # parse columns.coltype
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

    # parse .duetime
    match_data = /^(\d?\d):(\d\d)$/.match( params[:duetime] )
    dt_hour = match_data[1].to_i
    dt_min = match_data[2].to_i
    if dt_hour >=0 and dt_hour <= 23 and dt_min >= 0 and dt_min <= 59
      duetime = ( dt_hour * 60 + dt_min ) * 60
    else
      duetime = nil
    end

    # parse velocity
    match_data = /^((\d+)(\.\d+)?)%?$/.match( params[:velocity] )
    velocity = (match_data[1].to_f * 100).to_i

    initburndown = create_initburndown(taskboard_id)
    initburndown.dates = dates_trg_sorted.join(' '); # must be date-sorted
    initburndown.duetime = duetime unless duetime.nil?
    initburndown.capacity = params[:capacity].to_i
    initburndown.slack = params[:slack].to_i
    initburndown.commitment_po = params[:commitment_po].to_i
    initburndown.commitment_team = params[:commitment_team].to_i
    initburndown.velocity = velocity
    initburndown.save!

    render :json => sync_update_initburndown( taskboard_id, cols_updarr.join(' '), { :after => after } )
  end

  def get_fixburndown
    taskboard_id = params[:id].to_i
    taskboard = Taskboard.find(taskboard_id)
    initburndown = create_initburndown(taskboard_id)
    hours_map = get_initburndown_hours( taskboard, initburndown.dates )

    result = {}
    result['capacity'] = initburndown.capacity
    result['duetime_as_str'] = initburndown.duetime_as_str
    result['hours'] = hours_map['hours']

    render :json => result.to_json
  end

  # returns: { count => data-points, hours => [ [ 'YYYY-MM-DD', hours, secs ], ... ] }
  def get_initburndown_hours taskboard, dates_str
    dates_arr = []; # initburndown.dates as secs-array
    dates_map = {}; # dates_arr[secs] => dd.mm.yyyy
    hours_map = {}; # dd.mm.yyyy (for initburndown.dates) => hours
    count_map = {}; # date.secs => 0|1 (=count-it)

    # read Initburndown.dates (expecting to be sorted)
    cnt_entries = 0
    time_now = Time.now.to_i
    dates_str.split(' ').each { |date|
      match_data = /^(\d+)\.(\d+)\.(\d+)$/.match( date ) # DD.MM.YYYY
      date_s = sprintf( "%04d-%02d-%02d", match_data[3].to_i, match_data[2].to_i, match_data[1].to_i )
      date_i = make_time( date_s )
      dates_arr.push( date_i )
      dates_map[date_i] = date_s
      hours_map[date_s] = 0
      count_map[date_i] = ( date_i <= time_now )
    }

    # read Burnedhours
    cnt_bhours = 0
    taskboard.burnedhours.sort_by {|bhour| bhour.date}.each { |bhour|
      date_i = find_in_array( dates_arr, make_time_from_date(bhour.date).to_i )
      if not date_i.nil?
        date_s = dates_map[date_i]
        hours_map[date_s] = hours_map[date_s] + bhour.hours
        count_map[date_i] = true
      end
    }

    # build and sort result (using sorted dates_arr)
    result_arr = []
    dates_arr.each { |date_i|
      date_s = dates_map[date_i]
      result_arr.push [ date_s, hours_map[date_s], date_i ]
    }

    cnt_entries = ( count_map.values.find_all { |v| v } ).length

    result = {}
    result['count'] = [ cnt_entries, cnt_bhours ].max
    result['hours'] = result_arr
    result
  end

  def update_fixburndown
    taskboard = Taskboard.find( params[:taskboard_id].to_i )
    date_str = params[:date_str]
    update_hours = params[:hours]
    update_time = make_time_from_str( date_str )
    taskboard.update_burnedhours( update_hours.to_i, update_time, false )

    render :json => sync_update_fixburndown( taskboard.id, date_str, { :after => date_str + ":" + update_hours.to_s } )
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

    def find_in_array haystack, needle
      return nil if haystack.nil? or haystack.length == 0
      return haystack.first if needle < haystack.first

      for i in 1 .. haystack.length - 1
        return haystack[i-1] if haystack[i-1] <= needle and needle < haystack[i]
      end

      return haystack.last
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
