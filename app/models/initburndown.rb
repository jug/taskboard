class Initburndown < ActiveRecord::Base

  belongs_to :taskboard

  def clone taskboard_id = taskboard_id
    Initburndown.new( :taskboard_id => taskboard_id,
         :dates => dates, :duetime => duetime,
         :capacity => capacity, :slack => slack,
         :commitment_po => commitment_po, :commitment_team => commitment_team)
  end

  def duetime_as_str
    "%02d:%02d" % [ (duetime / 3600).to_i, ( duetime / 60 ).to_i % 60 ]
  end

  def to_json options = {}
    options[:methods] = []
    options[:methods] << :duetime_as_str
    super(options)
  end

end

