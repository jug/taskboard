class Initburndown < ActiveRecord::Base

  belongs_to :taskboard

  def clone
    cloned_burndown = Initburndown.new( :dates => dates, :capacity => capacity, :slack => slack, :commitment_po => commitment_po, :commitment_team => commitment_team)
    cloned_burndown
  end

  def to_json options = {}
    super(options)
  end

end

